import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

export interface PhoneVerificationProof {
  idToken: string;
  uid: string;
  phoneNumber: string;
  verifiedAt: string;
}

export interface PhoneVerificationStartResult {
  status: 'codeSent' | 'verified';
  proof?: PhoneVerificationProof;
}

@Injectable({
  providedIn: 'root'
})
export class PhoneVerificationService {
  private listenersAttached = false;
  private verificationId = '';
  private pendingPhoneNumber = '';
  private startResolver?: (value: PhoneVerificationStartResult) => void;
  private startRejecter?: (reason?: unknown) => void;

  isNativeSupported(): boolean {
    const platform = Capacitor.getPlatform();
    return Capacitor.isNativePlatform() && (platform === 'android' || platform === 'ios');
  }

  clearVerificationState(): void {
    this.verificationId = '';
    this.pendingPhoneNumber = '';
    this.startResolver = undefined;
    this.startRejecter = undefined;
  }

  async startVerification(phoneNumber: string): Promise<PhoneVerificationStartResult> {
    if (!this.isNativeSupported()) {
      throw new Error('Phone verification is currently available on the mobile app only.');
    }

    await this.attachListeners();
    this.clearVerificationState();
    this.pendingPhoneNumber = phoneNumber;

    return new Promise<PhoneVerificationStartResult>(async (resolve, reject) => {
      this.startResolver = resolve;
      this.startRejecter = reject;
      try {
        await FirebaseAuthentication.signOut().catch(() => undefined);
        await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber });
      } catch (error: any) {
        this.clearVerificationState();
        reject(this.normalizeError(error));
      }
    });
  }

  async confirmCode(verificationCode: string): Promise<PhoneVerificationProof> {
    if (!this.verificationId) {
      throw new Error('Request a verification code first.');
    }
    if (!verificationCode?.trim()) {
      throw new Error('Enter the verification code sent to your phone.');
    }

    const result = await FirebaseAuthentication.confirmVerificationCode({
      verificationId: this.verificationId,
      verificationCode: verificationCode.trim()
    });

    const proof = await this.buildProof(result?.user?.phoneNumber || this.pendingPhoneNumber);
    this.clearVerificationState();
    return proof;
  }

  private async attachListeners(): Promise<void> {
    if (this.listenersAttached) {
      return;
    }

    await FirebaseAuthentication.addListener('phoneCodeSent', async (event: any) => {
      this.verificationId = String(event?.verificationId || '');
      const resolve = this.startResolver;
      this.startResolver = undefined;
      this.startRejecter = undefined;
      resolve?.({ status: 'codeSent' });
    });

    await FirebaseAuthentication.addListener('phoneVerificationCompleted', async (event: any) => {
      try {
        const proof = await this.buildProof(event?.result?.user?.phoneNumber || this.pendingPhoneNumber);
        const resolve = this.startResolver;
        this.clearVerificationState();
        resolve?.({ status: 'verified', proof });
      } catch (error) {
        const reject = this.startRejecter;
        this.clearVerificationState();
        reject?.(error);
      }
    });

    await FirebaseAuthentication.addListener('phoneVerificationFailed', async (event: any) => {
      const reject = this.startRejecter;
      const error = this.normalizeError(event);
      this.clearVerificationState();
      reject?.(error);
    });

    this.listenersAttached = true;
  }

  private async buildProof(fallbackPhoneNumber: string): Promise<PhoneVerificationProof> {
    const tokenResult = await FirebaseAuthentication.getIdToken({ forceRefresh: true });
    const currentUser = await FirebaseAuthentication.getCurrentUser();
    const phoneNumber = String(currentUser?.user?.phoneNumber || fallbackPhoneNumber || '').trim();
    const uid = String(currentUser?.user?.uid || '').trim();

    await FirebaseAuthentication.signOut().catch(() => undefined);

    if (!tokenResult?.token || !uid || !phoneNumber) {
      throw new Error('Phone verification completed, but the verification proof was incomplete.');
    }

    return {
      idToken: tokenResult.token,
      uid,
      phoneNumber,
      verifiedAt: new Date().toISOString()
    };
  }

  private normalizeError(error: any): Error {
    const message = String(
      error?.message ||
      error?.error?.message ||
      error?.localizedMessage ||
      'Phone verification failed.'
    ).trim();
    return new Error(message);
  }
}

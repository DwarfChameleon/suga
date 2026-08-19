import { AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone, OnDestroy, Output, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { AuthService } from 'src/app/services/authservice.service';
import { LoadingService } from 'src/app/services/loading.service';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';
import { AccountReadinessService } from 'src/app/services/account-readiness.service';
import { environment } from 'src/environments/environment';

declare global {
  interface Window {
    google: any;
  }
}

@Component({
  selector: 'app-google-signin',
  templateUrl: './google-signin.component.html',
  styleUrls: ['./google-signin.component.scss']
})
export class GoogleSigninComponent implements AfterViewInit, OnDestroy {
  @Input() role: 'consumer' | 'chef' | 'dispatch' = 'consumer';
  @Input() context: 'login' | 'register' = 'login';
  @Output() authenticated = new EventEmitter<any>();
  @ViewChild('googleButtonContainer', { static: true }) googleButtonContainer!: ElementRef<HTMLDivElement>;

  private static gsiScriptPromise?: Promise<void>;
  private static nativeGoogleInitPromise?: Promise<void>;
  private destroyed = false;
  isGoogleBusy = false;
  webButtonReady = false;
  webButtonFailed = false;
  readonly isNativeApp = Capacitor.isNativePlatform();

  get googleButtonText(): string {
    if (this.isGoogleBusy) {
      return 'Opening Google...';
    }
    return this.context === 'register' ? 'Sign up with Google' : 'Continue with Google';
  }

  constructor(
    private readonly authService: AuthService,
    private readonly loadingService: LoadingService,
    private readonly uiFeedback: UiFeedbackService,
    private readonly router: Router,
    private readonly zone: NgZone,
    private readonly accountReadiness: AccountReadinessService
  ) {}

  ngAfterViewInit(): void {
    void this.initializeGoogleButton();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
  }

  private async initializeGoogleButton(): Promise<void> {
    if (this.isNativeApp || !this.googleButtonContainer?.nativeElement) {
      return;
    }

    try {
      this.webButtonFailed = false;
      await this.loadGoogleScript();
      if (this.destroyed) return;

      const clientId = environment.googleClientId;
      if (!clientId) {
        this.uiFeedback.error('Google Sign-In is not configured.');
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: any) => {
          const credential = response?.credential;
          if (!credential) {
            this.uiFeedback.error('Google sign-in failed. Please try again.');
            return;
          }
          void this.handleGoogleCredential(credential);
        }
      });

      this.googleButtonContainer.nativeElement.innerHTML = '';
      window.google.accounts.id.renderButton(this.googleButtonContainer.nativeElement, {
        type: 'standard',
        shape: 'pill',
        theme: 'outline',
        text: this.context === 'register' ? 'signup_with' : 'continue_with',
        size: 'large',
        width: 260
      });
      this.webButtonReady = true;
    } catch (error) {
      console.error('Google script load failed:', error);
      this.webButtonFailed = true;
      this.uiFeedback.error('Unable to load Google sign-in.');
    }
  }

  async retryWebGoogleButton(): Promise<void> {
    this.isGoogleBusy = true;
    try {
      GoogleSigninComponent.gsiScriptPromise = undefined;
      await this.initializeGoogleButton();
      if (!this.webButtonReady) {
        this.uiFeedback.error('Google sign-in is still not ready. Check your browser connection or Google OAuth origin.');
      }
    } finally {
      this.isGoogleBusy = false;
    }
  }

  async signInWithNativeGoogle(): Promise<void> {
    this.isGoogleBusy = true;
    try {
      await this.initializeNativeGoogle();
      await this.loadingService.show('Opening Google...');

      const result = await SocialLogin.login({
        provider: 'google',
        options: {
          style: 'bottom',
          filterByAuthorizedAccounts: false,
          autoSelectEnabled: false
        }
      });

      const idToken = this.resolveGoogleIdToken(result);
      if (!idToken) {
        throw new Error('Google sign-in did not return an ID token.');
      }

      await this.handleGoogleCredential(idToken, true);
    } catch (error: any) {
      await this.loadingService.hide();
      if (this.isUserCancellation(error) || error?.uiHandled) {
        return;
      }
      console.error('Native Google sign-in failed:', error);
      this.uiFeedback.error(this.resolveNativeGoogleError(error));
    } finally {
      this.isGoogleBusy = false;
    }
  }

  private async handleGoogleCredential(idToken: string, loaderAlreadyVisible = false): Promise<void> {
    if (!loaderAlreadyVisible) {
      await this.loadingService.show('Signing in with Google...');
    }

    return new Promise<void>((resolve, reject) => {
      this.authService.loginWithGoogle(idToken, [this.role]).subscribe({
        next: async (response) => {
          await this.loadingService.hide();
          this.isGoogleBusy = false;
          this.authenticated.emit(response);
          if (this.authenticated.observers.length === 0) {
            this.accountReadiness.promptIfNeeded(response?.user, 'login');
            this.redirectAfterLogin(response);
          }
          resolve();
        },
        error: async (error) => {
          await this.loadingService.hide();
          this.isGoogleBusy = false;
          const message = error?.error?.message || error?.message || 'Google authentication failed.';
          this.uiFeedback.error(message);
          reject({ ...error, uiHandled: true });
        }
      });
    });
  }

  private resolveGoogleIdToken(result: any): string | null {
    const googleResult = result?.result || result || {};
    const directToken = googleResult.idToken || googleResult.jwt || googleResult.authorizationCode?.jwt;
    if (directToken) {
      return String(directToken);
    }
    if (googleResult.responseType === 'online' && googleResult.idToken) {
      return String(googleResult.idToken);
    }
    return null;
  }

  private redirectAfterLogin(response: any): void {
    this.zone.run(() => {
      const rolesRaw = response?.user?.roles ?? [];
      const roles = Array.isArray(rolesRaw) ? rolesRaw : [rolesRaw];
      if (roles.includes('chef')) {
        this.router.navigate(['/components/chef']);
      } else if (roles.includes('dispatch')) {
        this.router.navigate(['/components/dispatch']);
      } else {
        this.router.navigate(['/components/consumer']);
      }
    });
  }

  private loadGoogleScript(): Promise<void> {
    if (window.google?.accounts?.id) {
      return Promise.resolve();
    }
    if (GoogleSigninComponent.gsiScriptPromise) {
      return GoogleSigninComponent.gsiScriptPromise;
    }

    GoogleSigninComponent.gsiScriptPromise = new Promise<void>((resolve, reject) => {
      const resolveWhenReady = () => {
        this.waitForGoogleIdentity().then(resolve).catch(reject);
      };
      const existingScript = document.querySelector('script[data-google-identity="true"]') as HTMLScriptElement | null;
      if (existingScript) {
        resolveWhenReady();
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Identity script')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.setAttribute('data-google-identity', 'true');
      script.onload = resolveWhenReady;
      script.onerror = () => reject(new Error('Failed to load Google Identity script'));
      document.head.appendChild(script);
    });

    return GoogleSigninComponent.gsiScriptPromise;
  }

  private waitForGoogleIdentity(): Promise<void> {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const checkReady = () => {
        if (window.google?.accounts?.id) {
          resolve();
          return;
        }
        if (Date.now() - startedAt > 8000) {
          reject(new Error('Google Sign-In is not ready yet.'));
          return;
        }
        window.setTimeout(checkReady, 100);
      };
      checkReady();
    });
  }

  private initializeNativeGoogle(): Promise<void> {
    if (!this.isNativeApp) {
      return Promise.resolve();
    }

    const clientId = environment.googleClientId?.trim();
    if (!clientId) {
      this.uiFeedback.error('Google Sign-In is not configured.');
      return Promise.reject(new Error('Missing Google web client ID.'));
    }

    if (!GoogleSigninComponent.nativeGoogleInitPromise) {
      GoogleSigninComponent.nativeGoogleInitPromise = SocialLogin.initialize({
        google: {
          webClientId: clientId,
          mode: 'online'
        }
      }).catch((error) => {
        GoogleSigninComponent.nativeGoogleInitPromise = undefined;
        throw error;
      });
    }

    return GoogleSigninComponent.nativeGoogleInitPromise;
  }

  private isUserCancellation(error: any): boolean {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('cancel') || message.includes('dismiss') || message.includes('12501');
  }

  private resolveNativeGoogleError(error: any): string {
    const message = String(error?.message || error || '');
    if (message.toLowerCase().includes('no credentials')) {
      return 'No Google account is ready on this device yet. Add or unlock a Google account and try again.';
    }
    if (message.toLowerCase().includes('network')) {
      return 'Google sign-in could not reach the network. Please check your connection and try again.';
    }
    if (message.toLowerCase().includes('10') || message.toLowerCase().includes('developer_error')) {
      return 'Google Sign-In is not fully configured for this Android build. Check the package name and SHA fingerprints in Firebase/Google Cloud.';
    }
    return 'Google sign-in could not start on this device. Please try again.';
  }
}

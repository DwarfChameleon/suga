import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';
import { LoadingService } from 'src/app/services/loading.service';
import { environment } from 'src/environments/environment';
import { Browser } from '@capacitor/browser';
import { timeout } from 'rxjs/operators';

@Component({
  selector: 'app-payment-modal',
  templateUrl: './payment-modal.component.html',
  styleUrls: ['./payment-modal.component.scss']
})
export class PaymentModalComponent implements OnInit {
  @Input() orderId?: string;
  @Input() orderIds?: string[];
  @Input() dishName?: string;
  @Input() summaryLabel?: string;
  @Input() price?: number;
  @Input() feeAmount?: number;
  @Input() deliveryFee?: number;
  @Input() totalAmount?: number;

  password = '';
  walletAccount = '';
  paystackEmail = '';
  payMethod: 'BankTransfer' | 'OpayWalletNgQR' | 'OpayWalletNg' | 'Paystack' = 'BankTransfer';
  paymentProvider: 'opay' | 'paystack' = 'opay';
  transactionId?: string;
  paymentReference?: string;
  paymentHint = '';
  isSubmitting = false;
  walletBalance = 0;
  tokenBalance = 0;
  localPayMethod: 'wallet' | 'token' | 'split' = 'wallet';
  tokenAmount = 0;
  walletAmount = 0;
  readonly tokenRate = 10;

  constructor(
    private modalCtrl: ModalController,
    private http: HttpClient,
    private uiFeedback: UiFeedbackService,
    private loading: LoadingService
  ) {}

  ngOnInit(): void {
    this.fetchWalletBalances();
  }

  private fetchWalletBalances(): void {
    this.http.get<any>(`${environment.apiUrl}/wallet/me`).subscribe({
      next: (resp) => {
        this.walletBalance = Number(resp?.wallet?.balance || 0);
        this.tokenBalance = Number(resp?.rewards?.tokenBalance || 0);
        this.syncSplitDefaults();
      },
      error: () => {
        this.walletBalance = 0;
        this.tokenBalance = 0;
      }
    });
  }

  get tokenNairaValue(): number {
    return this.tokenBalance * this.tokenRate;
  }

  get canPayWithTokens(): boolean {
    return !!this.totalAmount && this.tokenNairaValue >= this.totalAmount;
  }

  get canUseWallet(): boolean {
    return !!this.totalAmount && this.walletBalance >= this.totalAmount;
  }

  get canUseToken(): boolean {
    return !!this.totalAmount && this.tokenNairaValue >= this.totalAmount;
  }

  get canSplit(): boolean {
    return !!this.totalAmount && (this.walletBalance + this.tokenNairaValue) >= this.totalAmount;
  }

  get localPayDisabled(): boolean {
    return !this.canUseWallet && !this.canUseToken && !this.canSplit;
  }

  onLocalPayMethodChange(): void {
    this.syncSplitDefaults();
  }

  private syncSplitDefaults(): void {
    if (!this.totalAmount) return;
    if (!this.canUseWallet && this.localPayMethod === 'wallet') {
      this.localPayMethod = this.canUseToken ? 'token' : this.canSplit ? 'split' : 'wallet';
    }
    if (!this.canUseToken && this.localPayMethod === 'token') {
      this.localPayMethod = this.canUseWallet ? 'wallet' : this.canSplit ? 'split' : 'wallet';
    }
    if (!this.canSplit && this.localPayMethod === 'split') {
      this.localPayMethod = this.canUseWallet ? 'wallet' : this.canUseToken ? 'token' : 'wallet';
    }
    if (!this.totalAmount) return;
    if (this.localPayMethod === 'split') {
      const maxTokenNaira = Math.min(this.tokenNairaValue, this.totalAmount);
      this.tokenAmount = Math.floor(maxTokenNaira / this.tokenRate);
      this.walletAmount = Math.max(0, this.totalAmount - this.tokenAmount * this.tokenRate);
    }
  }

  async continueToPayment(): Promise<void> {
    const hasOrderTarget = !!this.orderId || (Array.isArray(this.orderIds) && this.orderIds.length > 0);
    if (!hasOrderTarget || !this.totalAmount) {
      this.uiFeedback.error('Order details missing.');
      return;
    }
    if (!this.password) {
      this.uiFeedback.error('Please enter your password to continue.');
      return;
    }
    if (this.payMethod === 'OpayWalletNg' && !this.walletAccount.trim()) {
      this.uiFeedback.error('Please enter your OPay account number.');
      return;
    }
    if (this.payMethod === 'Paystack' && !this.paystackEmail.trim()) {
      this.uiFeedback.error('Please enter your email address for Paystack.');
      return;
    }
    this.isSubmitting = true;
    await this.loading.show('Verifying...');
    this.http.post(`${environment.apiUrl}/auth/reauth`, { password: this.password }).pipe(timeout(20000)).subscribe({
      next: () => this.initiatePayment(),
      error: (err) => {
        this.loading.hide();
        this.isSubmitting = false;
        if (err?.status === 423) {
          this.uiFeedback.error('Account locked. Please contact admin.');
          return;
        }
        this.uiFeedback.error(err?.name === 'TimeoutError' ? 'Password check timed out. Try again.' : 'Password incorrect.');
      }
    });
  }

  private initiatePayment(): void {
    this.paymentProvider = this.payMethod === 'Paystack' ? 'paystack' : 'opay';
    if (this.payMethod === 'Paystack') {
      this.initiatePaystackPayment();
    } else {
      this.initiateOpayPayment();
    }
  }

  onPayMethodChange(): void {
    this.paymentProvider = this.payMethod === 'Paystack' ? 'paystack' : 'opay';
    this.transactionId = undefined;
    this.paymentReference = undefined;
    this.paymentHint = '';
  }

  private initiateOpayPayment(): void {
    this.loading.show('Creating OPay payment...');
    this.http.post<any>(`${environment.apiUrl}/wallet/topup/initiate`, {
      orderId: this.orderId,
      orderIds: this.orderIds,
      amount: this.totalAmount,
      walletAccount: this.walletAccount.trim(),
      payMethod: this.payMethod
    }).pipe(timeout(30000)).subscribe({
      next: (resp) => {
        this.loading.hide();
        this.isSubmitting = false;
        this.transactionId = resp?.transactionId;
        const qrCode = resp?.nextAction?.qrCode || '';
        const deepLink = resp?.nextAction?.deepLink || '';
        const cashUrl = resp?.paymentData?.cashierUrl || '';
        const paymentUrl = deepLink || cashUrl || qrCode || '';
        if (paymentUrl) {
          void Browser.open({ url: paymentUrl, presentationStyle: 'fullscreen' });
          this.paymentHint = 'Complete payment in OPay, then tap Verify Payment.';
        } else {
          this.paymentHint = 'Payment created. Complete payment in OPay, then tap Verify Payment.';
        }
        this.uiFeedback.success('OPay payment initiated.');
      },
      error: (err) => {
        this.loading.hide();
        this.isSubmitting = false;
        this.uiFeedback.error(err?.name === 'TimeoutError' ? 'Payment setup timed out. Try again.' : 'Payment initiation failed.');
      }
    });
  }

  private initiatePaystackPayment(): void {
    this.loading.show('Creating Paystack payment...');
    this.http.post<any>(`${environment.apiUrl}/wallet/topup/initiate-paystack`, {
      orderId: this.orderId,
      orderIds: this.orderIds,
      amount: this.totalAmount,
      email: this.paystackEmail.trim()
    }).pipe(timeout(30000)).subscribe({
      next: (resp) => {
        this.loading.hide();
        this.isSubmitting = false;
        this.paymentProvider = 'paystack';
        this.transactionId = resp?.transactionId;
        this.paymentReference = resp?.reference;
        const authorizationUrl = resp?.data?.authorization_url || '';
        if (authorizationUrl) {
          try {
            sessionStorage.setItem('suga:pendingPaystackRef', this.paymentReference || '');
            sessionStorage.setItem('suga:pendingPaystackTx', this.transactionId || '');
          } catch {}
          void Browser.open({ url: authorizationUrl, presentationStyle: 'fullscreen' });
          this.paymentHint = 'Complete payment in the secure Paystack window, then return and tap Verify Payment.';
          this.uiFeedback.success('Paystack opened inside the app.');
          return;
        } else {
          this.paymentHint = 'Payment created. Complete payment on Paystack, then tap Verify Payment.';
        }
        this.uiFeedback.success('Paystack payment initiated.');
      },
      error: (err) => {
        this.loading.hide();
        this.isSubmitting = false;
        this.uiFeedback.error(err?.name === 'TimeoutError' ? 'Payment setup timed out. Try again.' : 'Payment initiation failed.');
      }
    });
  }

  verifyPayment(): void {
    if (!this.transactionId) {
      this.uiFeedback.error('No payment session found. Start payment first.');
      return;
    }
    this.isSubmitting = true;
    this.loading.show('Verifying payment...');
    
    if (this.paymentProvider === 'paystack') {
      this.confirmPaystackPayment(this.transactionId);
    } else {
      this.confirmOpayPayment(this.transactionId);
    }
  }

  private confirmOpayPayment(transactionId: string): void {
    this.http.post(`${environment.apiUrl}/wallet/topup/confirm`, {
      transactionId,
      paidAmount: this.totalAmount
    }).pipe(timeout(30000)).subscribe({
      next: () => {
        this.loading.hide();
        this.isSubmitting = false;
        this.uiFeedback.success('Payment successful. Order placed.');
        this.close(true);
      },
      error: (err) => {
        this.loading.hide();
        this.isSubmitting = false;
        this.uiFeedback.error(err?.name === 'TimeoutError' ? 'Verification timed out. Confirm payment and try Verify Payment again.' : 'Payment verification failed. Confirm reference and try again.');
      }
    });
  }

  private confirmPaystackPayment(transactionId: string): void {
    this.http.post(`${environment.apiUrl}/wallet/topup/verify-paystack`, {
      transactionId,
      reference: this.paymentReference
    }).pipe(timeout(30000)).subscribe({
      next: () => {
        try {
          sessionStorage.removeItem('suga:pendingPaystackRef');
          sessionStorage.removeItem('suga:pendingPaystackTx');
        } catch {}
        this.loading.hide();
        this.isSubmitting = false;
        this.uiFeedback.success('Payment successful. Order placed.');
        this.close(true);
      },
      error: (err) => {
        this.loading.hide();
        this.isSubmitting = false;
        this.uiFeedback.error(err?.name === 'TimeoutError' ? 'Verification timed out. Confirm payment and try Verify Payment again.' : 'Payment verification failed. Confirm payment was completed and try again.');
      }
    });
  }

  async close(paid = false): Promise<void> {
    await this.modalCtrl.dismiss({ paid });
  }

  payWithWalletOrTokens(): void {
    const hasOrderTarget = !!this.orderId || (Array.isArray(this.orderIds) && this.orderIds.length > 0);
    if (!hasOrderTarget || !this.totalAmount) {
      this.uiFeedback.error('Order details missing.');
      return;
    }

    const payload: any = {
      orderId: this.orderId,
      orderIds: this.orderIds,
      method: this.localPayMethod
    };

    if (this.localPayMethod === 'token') {
      payload.tokenAmount = this.tokenBalance;
    } else if (this.localPayMethod === 'wallet') {
      payload.walletAmount = this.totalAmount;
    } else {
      payload.tokenAmount = Math.max(0, Number(this.tokenAmount || 0));
      payload.walletAmount = Math.max(0, Number(this.walletAmount || 0));
    }

    this.isSubmitting = true;
    this.loading.show('Processing payment...');
    this.http.post(`${environment.apiUrl}/order/pay`, payload).pipe(timeout(30000)).subscribe({
      next: () => {
        this.loading.hide();
        this.isSubmitting = false;
        this.uiFeedback.success('Payment confirmed.');
        this.close(true);
      },
      error: (err) => {
        this.loading.hide();
        this.isSubmitting = false;
        this.uiFeedback.error(err?.name === 'TimeoutError' ? 'Payment is taking too long. Try again.' : (err?.error?.message || 'Payment failed.'));
      }
    });
  }
}

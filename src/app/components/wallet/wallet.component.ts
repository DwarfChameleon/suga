import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';
import { LoadingService } from 'src/app/services/loading.service';
import { TokenStorageService } from 'src/app/services/token-storage.service';
import { firstValueFrom } from 'rxjs';
import { ModalController } from '@ionic/angular';
import { OrderInfoComponent } from '../order-info/order-info.component';
import { humanizeHistoryLabel } from 'src/app/utils/history-formatters';
import { Browser } from '@capacitor/browser';

type WalletSectionKey = 'balance' | 'rewards' | 'payout' | 'transactions';

interface WalletSummary {
  balance: number;
  currency: string;
  isHidden: boolean;
}

interface WalletTx {
  _id?: string;
  type: string;
  amount: number;
  currency?: string;
  status: string;
  createdAt: string;
  description?: string;
  orderId?: string;
  reference?: string;
  meta?: any;
}

@Component({
  selector: 'app-wallet',
  templateUrl: './wallet.component.html',
  styleUrls: ['./wallet.component.scss']
})
export class WalletComponent implements OnInit {
  wallet: WalletSummary = { balance: 0, currency: 'NGN', isHidden: false };
  transactions: WalletTx[] = [];
  roles: string[] = [];
  canWithdraw = false;
  canDeposit = false;
  canTransfer = false;
  currentEmail = '';
  rewards = { pointsBalance: 0, tokenBalance: 0 };
  isLoading = false;
  depositAmount: number | null = null;
  transferAmount: number | null = null;
  transferUsername = '';
  withdrawAmount: number | null = null;
  activeForm: 'deposit' | 'transfer' | 'withdraw' | null = null;
  pin = '';
  pinPurpose: 'transfer' | 'withdraw' | null = null;
  showPinPad = false;
  banks: Array<{ name: string; code: string }> = [];
  payoutAccount = { bankCode: '', accountNumber: '', accountName: '' };
  isSavingPayout = false;
  withdrawMessage = '';
  withdrawMessageType: 'success' | 'error' = 'error';
  rewardsMessage = '';
  rewardsMessageType: 'success' | 'error' = 'error';
  sections = {
    balance: true,
    rewards: true,
    payout: true,
    transactions: true
  };

  constructor(
    private http: HttpClient,
    private uiFeedback: UiFeedbackService,
    private loading: LoadingService,
    private tokenStorage: TokenStorageService,
    private modalController: ModalController
  ) {}

  ngOnInit(): void {
    const user = this.tokenStorage.getUser();
    this.roles = (user?.roles || []).map((r: any) => String(r || '').toLowerCase());
    this.canWithdraw = this.roles.includes('chef') || this.roles.includes('dispatch');
    this.canDeposit = this.roles.includes('consumer');
    this.canTransfer = this.roles.includes('chef');
    this.currentEmail = String(user?.email || '').trim();
    this.loadWallet();
  }

  toggleBalance(): void {
    this.wallet.isHidden = !this.wallet.isHidden;
  }

  toggleSection(section: WalletSectionKey): void {
    this.sections[section] = !this.sections[section];
  }

  private async loadWallet(): Promise<void> {
    this.isLoading = true;
    await this.loading.show('Loading wallet...');
    try {
      const data = await firstValueFrom(this.http.get<any>(`${environment.apiUrl}/wallet/me`));
      const wallet = data?.wallet || {};
      this.wallet = {
        balance: wallet.balance ?? 0,
        currency: wallet.currency ?? 'NGN',
        isHidden: false
      };
      this.transactions = data?.transactions || [];
      this.rewards = {
        pointsBalance: data?.rewards?.pointsBalance ?? 0,
        tokenBalance: data?.rewards?.tokenBalance ?? 0
      };
      if (this.canWithdraw) {
        this.loadBanks();
      }
    } catch {
      this.wallet = { balance: 0, currency: 'NGN', isHidden: false };
      this.transactions = [];
      this.rewards = { pointsBalance: 0, tokenBalance: 0 };
      this.uiFeedback.error('Wallet service unavailable. Showing empty wallet.');
    } finally {
      this.isLoading = false;
      await this.loading.hide();
    }
  }

  openForm(form: 'deposit' | 'transfer' | 'withdraw'): void {
    if (form === 'deposit' && !this.canDeposit) {
      this.uiFeedback.error('Only consumers can add wallet funds directly.');
      return;
    }
    if (form === 'transfer' && !this.canTransfer) {
      this.uiFeedback.error('Only chefs can transfer wallet funds.');
      return;
    }
    if (form === 'withdraw' && !this.canWithdraw) {
      this.uiFeedback.error('Only chefs or dispatch riders can request withdrawals.');
      return;
    }
    this.activeForm = this.activeForm === form ? null : form;
  }

  closeForm(): void {
    this.activeForm = null;
    this.pin = '';
    this.pinPurpose = null;
    this.showPinPad = false;
    this.withdrawMessage = '';
  }

  async requestDeposit(): Promise<void> {
    if (!this.canDeposit) {
      this.uiFeedback.error('Direct wallet deposit is available to consumers only.');
      return;
    }
    const amount = Number(this.depositAmount || 0);
    if (!amount || amount <= 0) {
      this.uiFeedback.error('Enter a valid deposit amount.');
      return;
    }
    if (!this.currentEmail) {
      this.uiFeedback.error('Please add your email to continue with Paystack.');
      return;
    }

    await this.loading.show('Redirecting to Paystack...');
    try {
      const response = await firstValueFrom(this.http.post<any>(`${environment.apiUrl}/wallet/topup/initiate-paystack`, {
        amount,
        email: this.currentEmail
      }));
      const authorizationUrl = String(response?.data?.authorization_url || '').trim();
      if (!authorizationUrl) {
        throw new Error('Unable to start Paystack payment right now.');
      }
      this.depositAmount = null;
      this.activeForm = null;
      this.uiFeedback.success('Paystack opened. Complete payment to top up your wallet.');
      await Browser.open({ url: authorizationUrl, presentationStyle: 'fullscreen' });
    } catch (error: any) {
      this.uiFeedback.error(error?.error?.message || error?.message || 'Deposit could not be started.');
    } finally {
      await this.loading.hide();
    }
  }

  async requestTransfer(): Promise<void> {
    if (!this.canTransfer) {
      this.uiFeedback.error('Only chefs can transfer wallet funds.');
      return;
    }
    if (!this.pin) {
      this.pinPurpose = 'transfer';
      this.showPinPad = true;
      return;
    }
    const amount = Number(this.transferAmount || 0);
    const toUsername = (this.transferUsername || '').trim();
    if (!amount || amount <= 0 || !toUsername) {
      this.uiFeedback.error('Enter recipient username and amount.');
      return;
    }

    await this.loading.show('Creating transfer request...');
    try {
      await firstValueFrom(this.http.post<any>(`${environment.apiUrl}/wallet/transfer/request`, { amount, toUsername, pin: this.pin }));
      this.transferAmount = null;
      this.transferUsername = '';
      this.activeForm = null;
      this.pin = '';
      this.uiFeedback.success('Transfer request submitted for review.');
      await this.loadWallet();
    } catch (error: any) {
      this.uiFeedback.error(error?.error?.message || 'Transfer request failed.');
    } finally {
      await this.loading.hide();
    }
  }

  async requestWithdraw(): Promise<void> {
    if (!this.canWithdraw) {
      this.uiFeedback.error('Only chefs or dispatch riders can request withdrawals.');
      return;
    }
    if (!this.pin) {
      this.pinPurpose = 'withdraw';
      this.showPinPad = true;
      return;
    }
    const amount = Number(this.withdrawAmount || 0);
    if (!amount || amount <= 0) {
      this.setWithdrawError('Enter a valid withdrawal amount.');
      return;
    }
    if (amount > Number(this.wallet.balance || 0)) {
      this.setWithdrawError('Insufficient balance for this withdrawal.');
      return;
    }

    await this.loading.show('Creating withdrawal request...');
    try {
      await firstValueFrom(this.http.post<any>(`${environment.apiUrl}/wallet/withdraw/request`, { amount, pin: this.pin }));
      this.withdrawAmount = null;
      this.pin = '';
      this.withdrawMessageType = 'success';
      this.withdrawMessage = 'Withdrawal request submitted for review.';
      this.uiFeedback.success(this.withdrawMessage);
      await this.loadWallet();
    } catch (error: any) {
      this.setWithdrawError(error?.error?.message || 'Withdrawal request failed.');
    } finally {
      await this.loading.hide();
    }
  }

  openPinPad(purpose: 'transfer' | 'withdraw'): void {
    if (purpose === 'withdraw' && this.withdrawalError) {
      this.setWithdrawError(this.withdrawalError);
      return;
    }
    this.pinPurpose = purpose;
    this.pin = '';
    this.showPinPad = true;
  }

  appendPin(digit: string): void {
    if (this.pin.length >= 4) return;
    this.pin += digit;
  }

  backspacePin(): void {
    this.pin = this.pin.slice(0, -1);
  }

  closePinPad(): void {
    this.showPinPad = false;
    this.pinPurpose = null;
    this.pin = '';
  }

  async confirmPin(): Promise<void> {
    if (this.pin.length !== 4 || !this.pinPurpose) {
      this.uiFeedback.error('Enter a valid 4-digit PIN.');
      return;
    }
    const purpose = this.pinPurpose;
    this.showPinPad = false;
    this.pinPurpose = null;
    if (purpose === 'transfer') {
      await this.requestTransfer();
    } else if (purpose === 'withdraw') {
      await this.requestWithdraw();
    }
  }

  async convertTokens(): Promise<void> {
    this.rewardsMessage = '';
    if (this.rewards.pointsBalance < 100 && this.rewards.tokenBalance <= 0) {
      this.rewardsMessageType = 'error';
      this.rewardsMessage = 'You need at least 100 points before converting to tokens.';
      return;
    }
    if (this.rewards.tokenBalance <= 0) {
      this.rewardsMessageType = 'error';
      this.rewardsMessage = 'No tokens available to convert yet.';
      return;
    }
    await this.loading.show('Converting tokens...');
    try {
      await firstValueFrom(this.http.post<any>(`${environment.apiUrl}/wallet/rewards/convert-tokens`, { tokens: this.rewards.tokenBalance }));
      this.rewardsMessageType = 'success';
      this.rewardsMessage = 'Tokens converted to wallet balance.';
      this.uiFeedback.success('Tokens converted to wallet balance.');
      await this.loadWallet();
    } catch (error: any) {
      this.rewardsMessageType = 'error';
      this.rewardsMessage = error?.error?.message || 'Token conversion failed.';
      this.uiFeedback.error(this.rewardsMessage);
    } finally {
      await this.loading.hide();
    }
  }

  get withdrawalError(): string {
    const amount = Number(this.withdrawAmount || 0);
    if (!amount || amount <= 0) return 'Enter a valid withdrawal amount.';
    if (amount > Number(this.wallet.balance || 0)) return 'Insufficient balance for this withdrawal.';
    return '';
  }

  onWithdrawAmountChange(): void {
    const error = this.withdrawalError;
    if (error && Number(this.withdrawAmount || 0) > Number(this.wallet.balance || 0)) {
      this.setWithdrawError(error);
      return;
    }
    if (this.withdrawMessageType === 'error') {
      this.withdrawMessage = '';
    }
  }

  private setWithdrawError(message: string): void {
    this.withdrawMessageType = 'error';
    this.withdrawMessage = message;
    this.uiFeedback.error(message);
  }

  async loadBanks(): Promise<void> {
    try {
      const data = await firstValueFrom(this.http.get<any>(`${environment.apiUrl}/wallet/payout-banks?currency=${encodeURIComponent(this.wallet.currency || 'NGN')}`));
      this.banks = (data?.banks || []).map((b: any) => ({ name: b.name, code: b.code }));
    } catch {
      this.banks = [];
    }
  }

  displayTransactionLabel(tx: WalletTx): string {
    return humanizeHistoryLabel(tx?.type);
  }

  async openTransactionDetails(tx: WalletTx): Promise<void> {
    if (!tx?.orderId) {
      this.uiFeedback.error('No linked order found for this transaction.');
      return;
    }

    const modal = await this.modalController.create({
      component: OrderInfoComponent,
      componentProps: { orderId: tx.orderId },
      cssClass: 'suga-order-fullsheet'
    });
    await modal.present();
  }

  async savePayoutAccount(): Promise<void> {
    if (!this.payoutAccount.bankCode || !this.payoutAccount.accountNumber || !this.payoutAccount.accountName) {
      this.uiFeedback.error('Select a bank and enter account number + name.');
      return;
    }
    this.isSavingPayout = true;
    await this.loading.show('Saving payout account...');
    try {
      await firstValueFrom(this.http.post<any>(`${environment.apiUrl}/wallet/payout-account`, this.payoutAccount));
      this.uiFeedback.success('Payout account saved.');
    } catch (error: any) {
      this.uiFeedback.error(error?.error?.message || 'Failed to save payout account.');
    } finally {
      this.isSavingPayout = false;
      await this.loading.hide();
    }
  }

  async resolveAccountName(): Promise<void> {
    if (!this.payoutAccount.bankCode || !this.payoutAccount.accountNumber) {
      this.uiFeedback.error('Select a bank and enter account number.');
      return;
    }
    await this.loading.show('Resolving account...');
    try {
      const data = await firstValueFrom(
        this.http.get<any>(`${environment.apiUrl}/wallet/resolve-account?bankCode=${this.payoutAccount.bankCode}&accountNumber=${this.payoutAccount.accountNumber}`)
      );
      if (data?.accountName) {
        this.payoutAccount.accountName = data.accountName;
        this.uiFeedback.success('Account name resolved.');
      } else {
        this.uiFeedback.error('Account name not found.');
      }
    } catch (error: any) {
      this.uiFeedback.error(error?.error?.message || 'Resolve failed.');
    } finally {
      await this.loading.hide();
    }
  }
}

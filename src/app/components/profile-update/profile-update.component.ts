import { Component, OnInit } from '@angular/core';
import { UserService, UserSettings } from 'src/app/services/user.service';
import { UserDetails } from 'src/app/interface/user-details';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';
import { ThemeService } from 'src/app/services/theme.service';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AddressDataService } from 'src/app/services/address-data.service';
import { CurrencyFormatService } from 'src/app/services/currency-format.service';
import { TokenStorageService } from 'src/app/services/token-storage.service';

@Component({
  selector: 'app-profile-update',
  templateUrl: './profile-update.component.html',
  styleUrls: ['./profile-update.component.scss']
})
export class ProfileUpdateComponent implements OnInit {
  user: UserDetails = {
    _id: '',
    username: '',
    email: '',
    roles: [],
    phone: '',
    homeAddress: ''
  };

  settings: UserSettings = {
    username: '',
    email: '',
    roles: [],
    phoneNumber: '',
    homeAddress: '',
    city: '',
    country: '',
    preferredCurrency: 'NGN',
    isOnline: true,
    uiTheme: 'light',
    isPrivateChef: false
  };
  oldPassword = '';
  newPassword = '';
  oldPin = '';
  newPin = '';
  isSaving = false;
  isChef = false;
  hasExistingPin = false;
  followRequests: Array<{ requesterId: string; username: string; profilePicture: string; country?: string; requestedAt: string }> = [];
  countries = this.addressData.getCountries();

  constructor(
    private userService: UserService,
    private uiFeedback: UiFeedbackService,
    private themeService: ThemeService,
    private addressData: AddressDataService,
    private currencyFormat: CurrencyFormatService,
    private tokenStorage: TokenStorageService
  ) {}

  ngOnInit(): void {
    void this.loadAll();
  }

  async loadAll(): Promise<void> {
    let userDetails: UserDetails | null = null;
    let settingsRes: UserSettings | null = null;

    try {
      userDetails = await firstValueFrom(this.userService.getUserDetails());
      this.user = userDetails;
    } catch (error) {
      console.error('Error loading user details:', error);
    }

    try {
      settingsRes = await firstValueFrom(this.userService.getSettings());
      this.settings = settingsRes;
      this.isChef = (settingsRes.roles || []).includes('chef');
      this.themeService.apply(settingsRes.uiTheme || 'light');
      this.hasExistingPin = !!settingsRes.hasTransactionPin;
    } catch (error) {
      console.error('Error loading settings:', error);
      if (userDetails) {
        this.settings = {
          ...this.settings,
          username: userDetails.username || '',
          email: userDetails.email || '',
          roles: userDetails.roles || [],
          homeAddress: userDetails.homeAddress || '',
          phoneNumber: userDetails.phone || '',
          country: userDetails.country || '',
          isOnline: true,
          uiTheme: this.themeService.getSavedTheme(),
          isPrivateChef: false
        };
        this.isChef = (this.settings.roles || []).includes('chef');
      }
      this.uiFeedback.error('Failed to load full settings. Some fields may be unavailable.');
    }

    if (this.isChef) {
      await this.loadFollowRequests();
    }
  }

  async loadFollowRequests(): Promise<void> {
    try {
      const data = await firstValueFrom(this.userService.getMyFollowRequests());
      this.followRequests = data.requests || [];
    } catch (error: any) {
      if (error?.status !== 403) {
        console.error('Error loading follow requests:', error);
      }
      this.followRequests = [];
    }
  }

  async saveSettings(): Promise<void> {
    this.isSaving = true;
    try {
      const payload = {
        isOnline: this.settings.isOnline,
        uiTheme: this.settings.uiTheme,
        country: this.settings.country,
        preferredCurrency: this.settings.preferredCurrency,
        countryVerification: this.getCountryVerificationHints(),
        isPrivateChef: this.isChef ? this.settings.isPrivateChef : undefined
      };
      const response = await firstValueFrom(this.userService.updateSettings(payload));
      this.settings = response.settings;
      this.syncStoredUserCurrency();
      this.themeService.apply(this.settings.uiTheme || 'light');
      this.uiFeedback.success('Settings updated.');
    } catch (error: any) {
      console.error('Error updating settings:', error);
      this.uiFeedback.error(error?.error?.message || 'Unable to update settings.');
    } finally {
      this.isSaving = false;
    }
  }

  async onThemeChanged(): Promise<void> {
    this.themeService.apply(this.settings.uiTheme || 'light');
    try {
      await firstValueFrom(this.userService.updateSettings({ uiTheme: this.settings.uiTheme }));
    } catch (error: any) {
      this.uiFeedback.error(error?.error?.message || 'Unable to persist theme preference.');
    }
  }

  onCountryChanged(): void {
    this.settings.preferredCurrency = this.currencyFormat.getCurrencyForCountry(this.settings.country);
  }

  get isZimbabweUser(): boolean {
    return String(this.settings.country || '').trim().toLowerCase() === 'zimbabwe';
  }

  get currencyOptions(): string[] {
    return this.isZimbabweUser ? ['ZWG', 'USD'] : [this.currencyFormat.getCurrencyForCountry(this.settings.country)];
  }

  get preferredCurrencyLabel(): string {
    const currency = this.settings.preferredCurrency || this.currencyFormat.getCurrencyForCountry(this.settings.country);
    return currency;
  }

  private getCountryVerificationHints(): Record<string, any> {
    return {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      language: navigator.language || '',
      languages: navigator.languages || [],
      userAgent: navigator.userAgent || '',
      dialCode: this.addressData.getDialCode(this.settings.country || '')
    };
  }

  private syncStoredUserCurrency(): void {
    const user = this.tokenStorage.getUser();
    if (!user) return;
    this.tokenStorage.saveUser({
      ...user,
      country: this.settings.country,
      preferredCurrency: this.settings.preferredCurrency
    });
  }

  async updatePassword(): Promise<void> {
    if (!this.oldPassword || !this.newPassword) {
      this.uiFeedback.error('Enter old and new passwords.');
      return;
    }
    try {
      const response = await firstValueFrom(this.userService.changePassword(this.oldPassword, this.newPassword));
      this.oldPassword = '';
      this.newPassword = '';
      this.uiFeedback.success(response.message || 'Password changed.');
    } catch (error: any) {
      this.uiFeedback.error(error?.error?.message || 'Password change failed.');
    }
  }

  async savePin(): Promise<void> {
    if (!/^\d{4}$/.test(this.newPin)) {
      this.uiFeedback.error('PIN must be exactly 4 digits.');
      return;
    }
    try {
      const response = await firstValueFrom(this.userService.upsertTransactionPin(this.newPin, this.oldPin || undefined));
      this.oldPin = '';
      this.newPin = '';
      this.hasExistingPin = true;
      this.uiFeedback.success(response.message || 'Transaction PIN saved.');
    } catch (error: any) {
      this.uiFeedback.error(error?.error?.message || 'Unable to save transaction PIN.');
    }
  }

  async approveFollow(requesterId: string): Promise<void> {
    try {
      await firstValueFrom(this.userService.approveFollowRequest(requesterId));
      this.followRequests = this.followRequests.filter(r => r.requesterId !== requesterId);
      this.uiFeedback.success('Follow request approved.');
    } catch (error: any) {
      this.uiFeedback.error(error?.error?.message || 'Unable to approve request.');
    }
  }

  async rejectFollow(requesterId: string): Promise<void> {
    try {
      await firstValueFrom(this.userService.rejectFollowRequest(requesterId));
      this.followRequests = this.followRequests.filter(r => r.requesterId !== requesterId);
      this.uiFeedback.success('Follow request rejected.');
    } catch (error: any) {
      this.uiFeedback.error(error?.error?.message || 'Unable to reject request.');
    }
  }

  getRequesterImage(profilePicture: string): string {
    const cleaned = profilePicture ? profilePicture.replace(/\\/g, '/') : '';
    if (!cleaned) return '/assets/img/regpage.jpeg';
    if (cleaned.startsWith('uploads/')) return `${environment.baseUrl}/${cleaned}`;
    if (cleaned.startsWith('profile-pictures/')) return `${environment.uploadUrl}/${cleaned}`;
    if (cleaned.includes('uploads/profile-pictures/')) return `${environment.baseUrl}/${cleaned}`;
    return `${environment.uploadUrl}/profile-pictures/${cleaned}`;
  }
}

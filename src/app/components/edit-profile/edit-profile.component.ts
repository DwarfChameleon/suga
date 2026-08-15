import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { EditableProfile, UserService } from 'src/app/services/user.service';
import { TokenStorageService } from 'src/app/services/token-storage.service';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';
import { ThemeService } from 'src/app/services/theme.service';
import { AddressDataService, AddressFieldConfig, AddressFieldKey } from 'src/app/services/address-data.service';
import { MapService } from 'src/app/services/map.service';
import { PhoneVerificationProof, PhoneVerificationService } from 'src/app/services/phone-verification.service';
import { isValidInternationalPhone, normalizeInternationalPhone, phoneDigits, stripDialCode } from 'src/app/utils/phone-number';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-edit-profile',
  templateUrl: './edit-profile.component.html',
  styleUrls: ['./edit-profile.component.scss']
})
export class EditProfileComponent implements OnInit {
  @ViewChild('profileImageInput') profileImageInput?: ElementRef<HTMLInputElement>;
  @ViewChild('coverImageInput') coverImageInput?: ElementRef<HTMLInputElement>;

  profile: EditableProfile = {
    username: '',
    fullName: '',
    email: '',
    roles: [],
    phoneNumber: '',
    homeAddress: '',
    workAddress: '',
    restaurantAddress: '',
    city: '',
    state: '',
    region: '',
    suburb: '',
    localGovernment: '',
    street: '',
    country: '',
    locationInfo: '',
    uiTheme: 'light',
    emailVerified: false,
    emailVerifiedAt: null,
    dietPreferences: {
      allergies: [],
      desiredIngredients: []
    }
  };
  initialProfile: EditableProfile = this.getDefaultProfile();
  isSaving = false;
  isLoading = false;
  isLoaded = false;
  selectedProfileImage?: File;
  selectedCoverImage?: File;
  private touchedFields: Record<string, boolean> = {};
  readonly countryOptions = this.addressData.getCountries();
  activeFields: AddressFieldConfig[] = [];
  regions: string[] = [];
  states: string[] = [];
  cities: string[] = [];
  suburbs: string[] = [];
  streetSuggestions: Array<{ displayName: string; lat: number; lng: number; address: any }> = [];
  private streetTimer?: ReturnType<typeof setTimeout>;
  readonly requiresPhoneVerification = this.phoneVerification.isNativeSupported();
  phoneVerificationState: 'idle' | 'sending' | 'codeSent' | 'verified' = 'idle';
  phoneVerificationCode = '';
  phoneVerificationError = '';
  phoneVerificationProof: PhoneVerificationProof | null = null;
  isSendingVerificationEmail = false;
  isVerifyingEmailCode = false;
  emailVerificationCode = '';
  allergyDraft = '';
  desiredIngredientDraft = '';

  constructor(
    private readonly userService: UserService,
    private readonly tokenStorage: TokenStorageService,
    private readonly uiFeedback: UiFeedbackService,
    private readonly themeService: ThemeService,
    private readonly addressData: AddressDataService,
    private readonly mapService: MapService,
    private readonly phoneVerification: PhoneVerificationService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  get isChef(): boolean {
    return (this.profile.roles || []).map((r) => r.toLowerCase()).includes('chef');
  }

  get isConsumer(): boolean {
    return (this.profile.roles || []).map((r) => r.toLowerCase()).includes('consumer');
  }

  get phoneDialCode(): string {
    return this.addressData.getDialCode(this.profile.country || '');
  }

  openSettings(): void {
    this.router.navigate(['components/profile-update']);
  }

  get hasChanges(): boolean {
    const normalize = (data: EditableProfile) => JSON.stringify(this.normalizeProfile(data));
    const profileChanged = normalize(this.profile) !== normalize(this.initialProfile);
    const mediaChanged = !!this.selectedProfileImage || !!this.selectedCoverImage;
    const phoneVerificationChanged = !!this.phoneVerificationProof;
    return profileChanged || mediaChanged || phoneVerificationChanged;
  }

  get isFormValid(): boolean {
    return !this.getFieldError('username')
      && !this.getFieldError('email')
      && !this.getFieldError('phoneNumber')
      && !this.getFieldError('fullName')
      && !this.getFieldError('city')
      && !this.getFieldError('state')
      && !this.getFieldError('region')
      && !this.getFieldError('suburb')
      && !this.getFieldError('localGovernment')
      && !this.getFieldError('street')
      && !this.getFieldError('country')
      && !this.getFieldError('homeAddress')
      && !this.getFieldError('workAddress')
      && !this.getFieldError('restaurantAddress')
      && !this.getFieldError('locationInfo');
  }

  markTouched(field: string): void {
    this.touchedFields[field] = true;
  }

  isFieldInvalid(field: string): boolean {
    return !!this.touchedFields[field] && !!this.getFieldError(field);
  }

  getFieldError(field: string): string | null {
    const value = String((this.profile as any)[field] ?? '').trim();
    switch (field) {
      case 'username':
        if (!value) return 'Username is required.';
        if (value.length < 3) return 'Username must be at least 3 characters.';
        if (!/^[a-zA-Z0-9._-]+$/.test(value)) return 'Use letters, numbers, dot, underscore, or hyphen only.';
        return null;
      case 'email':
        if (!value) return 'Email is required.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.';
        return null;
      case 'phoneNumber':
        if (!value) return 'Phone number is required.';
        if (!isValidInternationalPhone(this.toInternationalPhone(value))) return 'Enter a valid phone number.';
        return null;
      case 'fullName':
      case 'city':
      case 'state':
      case 'region':
      case 'suburb':
      case 'localGovernment':
      case 'street':
      case 'country':
        if (value.length > 80) return 'Maximum length is 80 characters.';
        return null;
      case 'homeAddress':
      case 'workAddress':
      case 'restaurantAddress':
      case 'locationInfo':
        if (value.length > 240) return 'Maximum length is 240 characters.';
        return null;
      default:
        return null;
    }
  }

  async loadProfile(): Promise<void> {
    this.isLoading = true;
    try {
      const loaded = await firstValueFrom(this.userService.getEditableProfile());
      this.profile = this.normalizeProfile(loaded);
      this.initialProfile = this.normalizeProfile(loaded);
      this.applyCountryProfile(this.profile.country || '');
      this.touchedFields = {};
      this.isLoaded = true;
    } catch {
      this.uiFeedback.error('Unable to load profile details.');
    } finally {
      this.isLoading = false;
    }
  }

  onProfileImageChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedProfileImage = input.files?.[0] || undefined;
  }

  onCoverImageChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedCoverImage = input.files?.[0] || undefined;
  }

  onStreetInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value || '';
    if (this.streetTimer) {
      clearTimeout(this.streetTimer);
    }
    if (value.trim().length < 4) {
      this.streetSuggestions = [];
      return;
    }
    this.streetTimer = setTimeout(() => {
      this.mapService.geocode(value).subscribe({
        next: (res) => {
          this.streetSuggestions = Array.isArray(res?.results) ? res.results : [];
        },
        error: () => {
          this.streetSuggestions = [];
        }
      });
    }, 350);
  }

  applyStreetSuggestion(item: { displayName: string; address: any }): void {
    if (!item) return;
    this.profile.street = item.displayName;
    const addr = item.address || {};
    if (addr.city) this.profile.city = addr.city;
    if (addr.state) this.profile.state = addr.state;
    if (addr.country) this.profile.country = addr.country;
    this.suburbs = this.addressData.getSuburbs(this.profile.country || '', this.profile.state || this.profile.region || '', this.profile.city || '');
    this.streetSuggestions = [];
  }

  onPhoneNumberChange(): void {
    this.keepPhoneLocal();
    if (!this.phoneVerificationProof) {
      return;
    }
    const currentPhone = this.toInternationalPhone(this.profile.phoneNumber || '');
    if (phoneDigits(currentPhone) !== phoneDigits(this.phoneVerificationProof.phoneNumber)) {
      this.resetPhoneVerification();
    }
  }

  async startPhoneVerification(): Promise<void> {
    const phoneNumber = this.toInternationalPhone(this.profile.phoneNumber || '');
    if (!isValidInternationalPhone(phoneNumber)) {
      this.phoneVerificationError = 'Enter a valid phone number first.';
      this.uiFeedback.error(this.phoneVerificationError);
      return;
    }

    this.phoneVerificationState = 'sending';
    this.phoneVerificationError = '';
    try {
      const result = await this.phoneVerification.startVerification(phoneNumber);
      if (result.status === 'verified' && result.proof) {
        this.phoneVerificationProof = result.proof;
        this.phoneVerificationState = 'verified';
        this.profile.phoneNumber = stripDialCode(result.proof.phoneNumber, this.phoneDialCode);
        this.uiFeedback.success('Phone number verified.');
      } else {
        this.phoneVerificationState = 'codeSent';
        this.profile.phoneNumber = stripDialCode(phoneNumber, this.phoneDialCode);
        this.uiFeedback.success('Verification code sent to your phone.');
      }
    } catch (error: any) {
      this.phoneVerificationState = 'idle';
      this.phoneVerificationError = error?.message || 'Unable to verify phone number.';
      this.uiFeedback.error(this.phoneVerificationError);
    }
  }

  async confirmPhoneVerification(): Promise<void> {
    this.phoneVerificationError = '';
    try {
      const proof = await this.phoneVerification.confirmCode(this.phoneVerificationCode);
      this.phoneVerificationProof = proof;
      this.phoneVerificationState = 'verified';
      this.profile.phoneNumber = stripDialCode(proof.phoneNumber, this.phoneDialCode);
      this.uiFeedback.success('Phone number verified.');
    } catch (error: any) {
      this.phoneVerificationError = error?.message || 'Verification code is invalid.';
      this.uiFeedback.error(this.phoneVerificationError);
    }
  }

  pickProfileImage(): void {
    this.profileImageInput?.nativeElement.click();
  }

  pickCoverImage(): void {
    this.coverImageInput?.nativeElement.click();
  }

  getProfileImageUrl(value?: string): string {
    return this.getUploadedImageUrl(value, 'profile-pictures');
  }

  getCoverImageUrl(value?: string): string {
    return this.getUploadedImageUrl(value, 'cover-pictures');
  }

  async save(): Promise<void> {
    this.applyPendingDietDrafts();

    if (!this.isFormValid) {
      [
        'username', 'email', 'phoneNumber', 'fullName',
        'city', 'state', 'region', 'suburb', 'localGovernment', 'street', 'country', 'homeAddress', 'workAddress',
        'restaurantAddress', 'locationInfo'
      ].forEach((field) => this.markTouched(field));
      this.uiFeedback.error('Please fix the highlighted fields.');
      return;
    }

    if (!this.hasChanges) {
      this.uiFeedback.error('No changes to save.');
      return;
    }

    const phoneNumberChanged = phoneDigits(this.toInternationalPhone(this.profile.phoneNumber || '')) !== phoneDigits(this.toInternationalPhone(this.initialProfile.phoneNumber || ''));
    this.isSaving = true;
    try {
      const response = await firstValueFrom(this.userService.updateEditableProfile({
        ...this.profile,
        phoneNumber: this.toInternationalPhone(this.profile.phoneNumber || ''),
        phoneVerification: phoneNumberChanged ? (this.phoneVerificationProof || undefined) : undefined
      }));
      this.profile = this.normalizeProfile(response.profile);
      this.initialProfile = this.normalizeProfile(response.profile);
      this.resetPhoneVerification();
      const existingUser = this.tokenStorage.getUser();
      if (existingUser) {
      this.tokenStorage.saveUser({
          ...existingUser,
          username: this.profile.username,
          email: this.profile.email,
          emailVerified: !!this.profile.emailVerified,
          profilePicture: this.profile.profilePicture,
          coverPicture: this.profile.coverPicture,
          dietPreferences: this.profile.dietPreferences
        });
      }

      if (this.selectedProfileImage || this.selectedCoverImage) {
        await this.uploadImages();
        await this.loadProfile();
      }

      if (this.profile.uiTheme) {
        this.themeService.apply(this.profile.uiTheme);
      }
      this.uiFeedback.success(response?.message || 'Profile updated successfully.');
    } catch (err: any) {
      this.uiFeedback.error(err?.error?.message || 'Unable to update profile.');
    } finally {
      this.isSaving = false;
    }
  }

  private async uploadImages(): Promise<void> {
    const username = this.profile.username;
    if (this.selectedProfileImage) {
      const form = new FormData();
      form.append('username', username);
      form.append('profilePicture', this.selectedProfileImage);
      await firstValueFrom(this.userService.uploadProfilePicture(form));
    }
    if (this.selectedCoverImage) {
      const form = new FormData();
      form.append('username', username);
      form.append('coverPicture', this.selectedCoverImage);
      await firstValueFrom(this.userService.uploadCoverPicture(form));
    }
    this.selectedProfileImage = undefined;
    this.selectedCoverImage = undefined;
  }

  addAllergy(): void {
    this.addDietItem('allergies', this.allergyDraft);
    this.allergyDraft = '';
  }

  addDesiredIngredient(): void {
    this.addDietItem('desiredIngredients', this.desiredIngredientDraft);
    this.desiredIngredientDraft = '';
  }

  removeDietItem(kind: 'allergies' | 'desiredIngredients', item: string): void {
    const preferences = this.profile.dietPreferences || { allergies: [], desiredIngredients: [] };
    const current = this.normalizePreferenceList(preferences[kind]);
    preferences[kind] = current.filter((value) => value !== this.normalizeDietItem(item));
    this.profile.dietPreferences = preferences;
  }

  private getDefaultProfile(): EditableProfile {
    return {
      username: '',
      fullName: '',
      email: '',
      roles: [],
      phoneNumber: '',
      homeAddress: '',
      workAddress: '',
      restaurantAddress: '',
      city: '',
      state: '',
      region: '',
      suburb: '',
      localGovernment: '',
      street: '',
      country: '',
      locationInfo: '',
      uiTheme: 'light',
      emailVerified: false,
      emailVerifiedAt: null,
      profilePicture: '',
      coverPicture: '',
      dietPreferences: {
        allergies: [],
        desiredIngredients: []
      }
    };
  }

  private normalizeProfile(data?: EditableProfile): EditableProfile {
    const defaults = this.getDefaultProfile();
    return {
      ...defaults,
      ...(data || {}),
      phoneNumber: stripDialCode(data?.phoneNumber || '', this.addressData.getDialCode(data?.country || '')),
      roles: Array.isArray(data?.roles) ? data!.roles : defaults.roles,
      dietPreferences: {
        allergies: this.normalizePreferenceList((data as any)?.dietPreferences?.allergies),
        desiredIngredients: this.normalizePreferenceList((data as any)?.dietPreferences?.desiredIngredients)
      }
    };
  }

  private addDietItem(kind: 'allergies' | 'desiredIngredients', value: string): void {
    const normalized = this.normalizeDietItem(value);
    if (!normalized) {
      return;
    }
    const preferences = this.profile.dietPreferences || { allergies: [], desiredIngredients: [] };
    const current = this.normalizePreferenceList(preferences[kind]);
    if (!current.includes(normalized)) {
      preferences[kind] = [...current, normalized];
    }
    this.profile.dietPreferences = preferences;
  }

  private normalizePreferenceList(value: any): string[] {
    const source = Array.isArray(value) ? value : String(value || '').split(/[\n,]/);
    return [...new Set(source.map((item) => this.normalizeDietItem(item)).filter(Boolean))];
  }

  private normalizeDietItem(value: any): string {
    return String(value || '').trim().toLowerCase();
  }

  private applyPendingDietDrafts(): void {
    if (this.allergyDraft.trim()) {
      this.addAllergy();
    }
    if (this.desiredIngredientDraft.trim()) {
      this.addDesiredIngredient();
    }
  }

  async sendVerificationEmail(): Promise<void> {
    if (this.isSendingVerificationEmail || !this.profile.email || this.profile.emailVerified) {
      return;
    }
    this.isSendingVerificationEmail = true;
    try {
      const response = await firstValueFrom(this.userService.sendEmailVerification());
      this.uiFeedback.success(response?.message || 'Verification email sent.');
    } catch (error: any) {
      this.uiFeedback.error(error?.error?.message || 'Unable to send verification email right now.');
    } finally {
      this.isSendingVerificationEmail = false;
    }
  }

  async verifyEmailCode(): Promise<void> {
    const code = this.emailVerificationCode.trim();
    if (this.isVerifyingEmailCode || this.profile.emailVerified) {
      return;
    }
    if (!/^[0-9]{6}$/.test(code)) {
      this.uiFeedback.error('Enter the 6-digit code sent to your email.');
      return;
    }

    this.isVerifyingEmailCode = true;
    try {
      const response = await firstValueFrom(this.userService.verifyEmailCode(code));
      this.profile.emailVerified = !!response?.emailVerified;
      this.profile.emailVerifiedAt = response?.emailVerifiedAt || new Date().toISOString();
      this.initialProfile = this.normalizeProfile(this.profile);
      this.emailVerificationCode = '';
      const existingUser = this.tokenStorage.getUser();
      if (existingUser) {
        this.tokenStorage.saveUser({
          ...existingUser,
          emailVerified: !!this.profile.emailVerified
        });
      }
      this.uiFeedback.success(response?.message || 'Email verified successfully.');
    } catch (error: any) {
      this.uiFeedback.error(error?.error?.message || 'Unable to verify email right now.');
    } finally {
      this.isVerifyingEmailCode = false;
    }
  }

  onCountryChanged(): void {
    this.applyCountryProfile(this.profile.country || '');
    this.profile.region = '';
    this.profile.state = '';
    this.profile.city = '';
    this.profile.suburb = '';
    this.profile.localGovernment = '';
    this.profile.street = '';
    this.keepPhoneLocal();
    this.markTouched('country');
  }

  onRegionOrStateChanged(): void {
    const locator = this.profile.state || this.profile.region || '';
    this.cities = this.addressData.getCities(this.profile.country || '', locator);
    this.profile.city = '';
    this.suburbs = [];
    this.profile.suburb = '';
  }

  onCityChanged(): void {
    const locator = this.profile.state || this.profile.region || '';
    this.suburbs = this.addressData.getSuburbs(this.profile.country || '', locator, this.profile.city || '');
    this.profile.suburb = '';
  }

  isAddressFieldActive(key: AddressFieldKey): boolean {
    return this.activeFields.some((f) => f.key === key);
  }

  isAddressFieldSelect(key: AddressFieldKey): boolean {
    return this.activeFields.find((f) => f.key === key)?.type === 'select';
  }

  addressFieldLabel(key: AddressFieldKey, fallback: string): string {
    return this.activeFields.find((f) => f.key === key)?.label || fallback;
  }

  private applyCountryProfile(country: string): void {
    this.activeFields = this.addressData.getFieldConfig(country);
    this.regions = this.addressData.getRegions(country);
    this.states = this.addressData.getStates(country);
    const locator = this.profile.state || this.profile.region || '';
    this.cities = this.addressData.getCities(country, locator);
    this.suburbs = this.addressData.getSuburbs(country, locator, this.profile.city || '');
  }

  private resetPhoneVerification(): void {
    this.phoneVerificationProof = null;
    this.phoneVerificationCode = '';
    this.phoneVerificationError = '';
    this.phoneVerificationState = 'idle';
    this.phoneVerification.clearVerificationState();
  }

  private keepPhoneLocal(): void {
    const local = stripDialCode(this.profile.phoneNumber || '', this.phoneDialCode);
    if (this.profile.phoneNumber !== local) {
      this.profile.phoneNumber = local;
    }
  }

  private toInternationalPhone(value: string): string {
    return normalizeInternationalPhone(value, this.phoneDialCode);
  }

  private getUploadedImageUrl(value: string | undefined, folder: string): string {
    let cleaned = String(value || '').trim().replace(/\\/g, '/');
    if (!cleaned) return '';
    if (/^https?:\/\//i.test(cleaned) || cleaned.startsWith('data:') || cleaned.startsWith('blob:')) {
      return cleaned;
    }
    const uploadsIndex = cleaned.toLowerCase().indexOf(`uploads/${folder}/`);
    if (uploadsIndex >= 0) {
      cleaned = cleaned.slice(uploadsIndex);
    }
    if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
      return cleaned;
    }
    if (cleaned.startsWith('uploads/')) {
      return `${environment.baseUrl}/${cleaned}`;
    }
    if (cleaned.startsWith(`${folder}/`)) {
      return `${environment.uploadUrl}/${cleaned}`;
    }
    if (cleaned.includes(`uploads/${folder}/`)) {
      return `${environment.baseUrl}/${cleaned}`;
    }
    return `${environment.uploadUrl}/${folder}/${cleaned}`;
  }
}

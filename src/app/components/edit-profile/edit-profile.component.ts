import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { EditableProfile, UserService } from 'src/app/services/user.service';
import { TokenStorageService } from 'src/app/services/token-storage.service';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';
import { ThemeService } from 'src/app/services/theme.service';
import { AddressDataService, AddressFieldKey } from 'src/app/services/address-data.service';
import { MapService } from 'src/app/services/map.service';

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
    themeColor: '#2c6ac2'
  };
  initialProfile: EditableProfile = this.getDefaultProfile();
  isSaving = false;
  isLoading = false;
  isLoaded = false;
  selectedProfileImage?: File;
  selectedCoverImage?: File;
  private touchedFields: Record<string, boolean> = {};
  readonly countryOptions = this.addressData.getCountries();
  activeFields: Array<{ key: AddressFieldKey; label: string; type: 'select' | 'text' }> = [];
  regions: string[] = [];
  states: string[] = [];
  cities: string[] = [];
  streetSuggestions: Array<{ displayName: string; lat: number; lng: number; address: any }> = [];
  private streetTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly userService: UserService,
    private readonly tokenStorage: TokenStorageService,
    private readonly uiFeedback: UiFeedbackService,
    private readonly themeService: ThemeService,
    private readonly addressData: AddressDataService,
    private readonly mapService: MapService
  ) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  get isChef(): boolean {
    return (this.profile.roles || []).map((r) => r.toLowerCase()).includes('chef');
  }

  get hasChanges(): boolean {
    const normalize = (data: EditableProfile) => JSON.stringify(this.normalizeProfile(data));
    const profileChanged = normalize(this.profile) !== normalize(this.initialProfile);
    const mediaChanged = !!this.selectedProfileImage || !!this.selectedCoverImage;
    return profileChanged || mediaChanged;
  }

  get isFormValid(): boolean {
    return !this.getFieldError('username')
      && !this.getFieldError('email')
      && !this.getFieldError('phoneNumber')
      && !this.getFieldError('themeColor')
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
        if (!/^\+?[0-9()\-\s]{7,20}$/.test(value)) return 'Enter a valid phone number.';
        return null;
      case 'themeColor':
        if (!value) return null;
        if (!/^#[0-9a-fA-F]{6}$/.test(value)) return 'Theme color must be a valid hex code.';
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
    this.streetSuggestions = [];
  }

  pickProfileImage(): void {
    this.profileImageInput?.nativeElement.click();
  }

  pickCoverImage(): void {
    this.coverImageInput?.nativeElement.click();
  }

  async save(): Promise<void> {
    if (!this.isFormValid) {
      [
        'username', 'email', 'phoneNumber', 'themeColor', 'fullName',
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

    this.isSaving = true;
    try {
      const response = await firstValueFrom(this.userService.updateEditableProfile(this.profile));
      this.profile = this.normalizeProfile(response.profile);
      this.initialProfile = this.normalizeProfile(response.profile);
      const existingUser = this.tokenStorage.getUser();
      if (existingUser) {
        this.tokenStorage.saveUser({
          ...existingUser,
          username: this.profile.username,
          email: this.profile.email,
          profilePicture: this.profile.profilePicture,
          coverPicture: this.profile.coverPicture
        });
      }

      if (this.selectedProfileImage || this.selectedCoverImage) {
        await this.uploadImages();
        await this.loadProfile();
      }

      if (this.profile.uiTheme) {
        this.themeService.apply(this.profile.uiTheme);
      }
      this.uiFeedback.success('Profile updated successfully.');
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
      themeColor: '#2c6ac2',
      profilePicture: '',
      coverPicture: ''
    };
  }

  private normalizeProfile(data?: EditableProfile): EditableProfile {
    const defaults = this.getDefaultProfile();
    return {
      ...defaults,
      ...(data || {}),
      roles: Array.isArray(data?.roles) ? data!.roles : defaults.roles
    };
  }

  onCountryChanged(): void {
    this.applyCountryProfile(this.profile.country || '');
    this.profile.region = '';
    this.profile.state = '';
    this.profile.city = '';
    this.profile.suburb = '';
    this.profile.localGovernment = '';
    this.profile.street = '';
    this.markTouched('country');
  }

  onRegionOrStateChanged(): void {
    const locator = this.profile.state || this.profile.region || '';
    this.cities = this.addressData.getCities(this.profile.country || '', locator);
    this.profile.city = '';
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
  }
}

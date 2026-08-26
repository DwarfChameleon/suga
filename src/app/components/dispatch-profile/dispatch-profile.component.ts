import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { DispatchService } from 'src/app/services/dispatch.service';
import { TokenStorageService } from 'src/app/services/token-storage.service';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';
import { UserService } from 'src/app/services/user.service';
import { AddressDataService, AddressFieldConfig, AddressFieldKey } from 'src/app/services/address-data.service';
import { resolveUploadUrl } from 'src/app/utils/media-url';

@Component({
  selector: 'app-dispatch-profile',
  templateUrl: './dispatch-profile.component.html',
  styleUrls: ['./dispatch-profile.component.scss']
})
export class DispatchProfileComponent implements OnInit, OnDestroy {
  loading = true;
  saving = false;
  profile: any = null;
  selectedProfileImage?: File;
  profileImagePreview = '';
  form = {
    fullName: '',
    email: '',
    phoneNumber: '',
    homeAddress: '',
    country: '',
    state: '',
    region: '',
    city: '',
    suburb: '',
    localGovernment: '',
    street: '',
    locationInfo: '',
    isCompany: false,
    companyName: '',
    vehicleTypes: '',
    plateNumber: '',
    licenseNumber: '',
    operatingAreas: '',
    isAvailable: true
  };

  constructor(
    private readonly dispatchService: DispatchService,
    private readonly tokenStorage: TokenStorageService,
    private readonly uiFeedback: UiFeedbackService,
    private readonly userService: UserService,
    private readonly addressData: AddressDataService,
    private readonly router: Router
  ) {}

  countryOptions = this.addressData.getCountries();
  activeFields: AddressFieldConfig[] = [];
  regions: string[] = [];
  states: string[] = [];
  cities: string[] = [];
  suburbs: string[] = [];
  expandedSections: Record<'personal' | 'business' | 'vehicle' | 'coverage', boolean> = {
    personal: true,
    business: true,
    vehicle: true,
    coverage: true
  };

  ngOnInit(): void {
    this.addressData.warmCatalog().then(() => {
      this.countryOptions = this.addressData.getCountries();
      this.applyCountryProfile(this.form.country || '');
    });
    this.loadProfile();
  }

  ngOnDestroy(): void {
    this.clearProfileImagePreview();
  }

  loadProfile(event?: any): void {
    this.loading = true;
    this.dispatchService.getProfile().subscribe({
      next: (res) => {
        this.profile = res;
        const dp = res?.dispatchProfile || {};
        this.form = {
          fullName: res?.fullName || '',
          email: res?.email || '',
          phoneNumber: res?.phoneNumber || '',
          homeAddress: res?.homeAddress || '',
          country: res?.country || '',
          state: res?.state || '',
          region: res?.region || '',
          city: res?.city || '',
          suburb: res?.suburb || '',
          localGovernment: res?.localGovernment || '',
          street: res?.street || '',
          locationInfo: res?.locationInfo || '',
          isCompany: !!dp.isCompany,
          companyName: dp.companyName || '',
          vehicleTypes: Array.isArray(dp.vehicleTypes) ? dp.vehicleTypes.join(', ') : '',
          plateNumber: dp.plateNumber || '',
          licenseNumber: dp.licenseNumber || '',
          operatingAreas: Array.isArray(dp.operatingAreas) ? dp.operatingAreas.join(', ') : '',
          isAvailable: dp.isAvailable !== false
        };
        this.applyCountryProfile(this.form.country || '');
        this.loading = false;
        event?.target?.complete?.();
      },
      error: (error) => {
        this.loading = false;
        event?.target?.complete?.();
        this.uiFeedback.error(error?.error?.message || 'Failed to load dispatch profile.');
      }
    });
  }

  onProfileImageChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.uiFeedback.error('Please select a valid image file.');
      input.value = '';
      return;
    }

    this.selectedProfileImage = file;
    this.clearProfileImagePreview();
    this.profileImagePreview = URL.createObjectURL(file);
  }

  getProfileImage(): string {
    if (this.profileImagePreview) {
      return this.profileImagePreview;
    }
    const storedUser = this.tokenStorage.getUser();
    return resolveUploadUrl(
      this.profile?.profilePicture
        || this.profile?.avatar
        || this.profile?.dispatchProfile?.photo
        || storedUser?.profilePicture
        || storedUser?.avatar,
      'assets/images/users/default-rider.jpg'
    );
  }

  async save(): Promise<void> {
    if (this.saving) return;
    if (this.invalidOperatingAreas.length > 0) {
      this.uiFeedback.error('Remove or correct the invalid operating areas marked in red.');
      return;
    }
    this.saving = true;
    const payload = {
      fullName: String(this.form.fullName || '').trim(),
      email: String(this.form.email || '').trim().toLowerCase(),
      phoneNumber: String(this.form.phoneNumber || '').trim(),
      homeAddress: String(this.form.homeAddress || '').trim(),
      country: String(this.form.country || '').trim(),
      state: String(this.form.state || '').trim(),
      region: String(this.form.region || '').trim(),
      city: String(this.form.city || '').trim(),
      suburb: String(this.form.suburb || '').trim(),
      localGovernment: String(this.form.localGovernment || '').trim(),
      street: String(this.form.street || '').trim(),
      locationInfo: String(this.form.locationInfo || '').trim(),
      isCompany: this.form.isCompany,
      companyName: String(this.form.companyName || '').trim(),
      plateNumber: String(this.form.plateNumber || '').trim(),
      licenseNumber: String(this.form.licenseNumber || '').trim(),
      isAvailable: this.form.isAvailable,
      vehicleTypes: String(this.form.vehicleTypes || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
      operatingAreas: String(this.form.operatingAreas || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    };

    try {
      const res = await firstValueFrom(this.dispatchService.updateProfile(payload).pipe(timeout(30000)));
      this.profile = { ...this.profile, ...(res?.profile || {}), dispatchProfile: res?.dispatchProfile };
      const storedAfterProfile = this.tokenStorage.getUser();
      if (storedAfterProfile) {
        this.tokenStorage.saveUser({
          ...storedAfterProfile,
          fullName: payload.fullName,
          email: payload.email,
          phoneNumber: payload.phoneNumber,
          homeAddress: payload.homeAddress,
          country: payload.country,
          state: payload.state,
          region: payload.region,
          city: payload.city,
          suburb: payload.suburb,
          localGovernment: payload.localGovernment,
          street: payload.street,
          locationInfo: payload.locationInfo
        });
      }

      if (this.selectedProfileImage) {
        const username = this.getProfileUsername();
        if (!username) {
          throw new Error('Username is required before uploading a profile picture.');
        }

        const form = new FormData();
        form.append('username', username);
        form.append('profilePicture', this.selectedProfileImage);
        const uploadRes = await firstValueFrom(this.userService.uploadProfilePicture(form).pipe(timeout(45000)));
        const user = uploadRes?.user || uploadRes?.profile || uploadRes;
        if (!user?.profilePicture) {
          throw new Error('Profile picture upload did not return an updated image.');
        }
        this.profile = {
          ...this.profile,
          username: user?.username || username,
          profilePicture: user.profilePicture
        };
        const stored = this.tokenStorage.getUser();
        if (stored) {
          this.tokenStorage.saveUser({
            ...stored,
            username: user?.username || stored.username,
            profilePicture: user.profilePicture
          });
        }
        this.selectedProfileImage = undefined;
        this.clearProfileImagePreview();
      }

      this.uiFeedback.success('Dispatch profile updated.');
      this.router.navigate(['/components/dispatch']);
    } catch (error: any) {
      const message = error?.error?.message || error?.message || 'Profile update failed.';
      this.uiFeedback.error(message);
    } finally {
      this.saving = false;
    }
  }

  private getProfileUsername(): string {
    return String(this.profile?.username || this.tokenStorage.getUser()?.username || '').trim();
  }

  get operatingAreaItems(): Array<{ value: string; valid: boolean }> {
    return this.parseOperatingAreas().map((value) => ({
      value,
      valid: this.isOperatingAreaValid(value)
    }));
  }

  get invalidOperatingAreas(): string[] {
    return this.operatingAreaItems.filter((item) => !item.valid).map((item) => item.value);
  }

  get operatingAreaSuggestions(): string[] {
    return this.getSelectedStateCoverageTerms()
      .filter((value) => !this.parseOperatingAreas().some((item) => item.toLowerCase() === value.toLowerCase()))
      .slice(0, 12);
  }

  addOperatingArea(area: string): void {
    const value = String(area || '').trim();
    if (!value) return;
    const current = this.parseOperatingAreas();
    if (!current.some((item) => item.toLowerCase() === value.toLowerCase())) {
      this.form.operatingAreas = [...current, value].join(', ');
    }
  }

  removeOperatingArea(area: string): void {
    this.form.operatingAreas = this.parseOperatingAreas()
      .filter((item) => item.toLowerCase() !== String(area || '').trim().toLowerCase())
      .join(', ');
  }

  onCountryChanged(): void {
    this.applyCountryProfile(this.form.country || '');
    this.form.region = '';
    this.form.state = '';
    this.form.city = '';
    this.form.suburb = '';
    this.form.localGovernment = '';
  }

  onRegionOrStateChanged(): void {
    const locator = this.form.state || this.form.region || '';
    this.cities = this.addressData.getCities(this.form.country || '', locator);
    this.form.city = '';
    this.suburbs = [];
    this.form.suburb = '';
  }

  onCityChanged(): void {
    const locator = this.form.state || this.form.region || '';
    this.suburbs = this.addressData.getSuburbs(this.form.country || '', locator, this.form.city || '');
    this.form.suburb = '';
  }

  isAddressFieldActive(key: AddressFieldKey): boolean {
    return this.activeFields.some((field) => field.key === key);
  }

  isAddressFieldSelect(key: AddressFieldKey): boolean {
    return this.activeFields.find((field) => field.key === key)?.type === 'select';
  }

  addressFieldLabel(key: AddressFieldKey, fallback: string): string {
    return this.activeFields.find((field) => field.key === key)?.label || fallback;
  }

  toggleSection(section: 'personal' | 'business' | 'vehicle' | 'coverage'): void {
    this.expandedSections[section] = !this.expandedSections[section];
  }

  private parseOperatingAreas(): string[] {
    return String(this.form.operatingAreas || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  private isOperatingAreaValid(value: string): boolean {
    const normalized = String(value || '').trim().toLowerCase();
    return this.getSelectedStateCoverageTerms().some((term) => term.toLowerCase() === normalized);
  }

  private getSelectedStateCoverageTerms(): string[] {
    const country = this.form.country;
    const stateOrRegion = this.form.state || this.form.region;
    if (!country || !stateOrRegion) {
      return [];
    }

    const terms: string[] = [];
    const cities = this.addressData.getCities(country, stateOrRegion);
    terms.push(...cities);
    for (const cityName of cities) {
      terms.push(...this.addressData.getSuburbs(country, stateOrRegion, cityName));
    }

    return [...new Set(terms.filter(Boolean))];
  }

  private applyCountryProfile(country: string): void {
    this.activeFields = this.addressData.getFieldConfig(country);
    this.regions = this.addressData.getRegions(country);
    this.states = this.addressData.getStates(country);
    const locator = this.form.state || this.form.region || '';
    this.cities = this.addressData.getCities(country, locator);
    this.suburbs = this.addressData.getSuburbs(country, locator, this.form.city || '');
  }

  private clearProfileImagePreview(): void {
    if (this.profileImagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(this.profileImagePreview);
    }
    this.profileImagePreview = '';
  }
}

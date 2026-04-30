import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';
import { UiFeedbackService } from '../services/ui-feedback.service';
import { LoadingService } from '../services/loading.service';
import { ModalControlService } from '../services/modal-control.service';
import { AddressDataService, AddressFieldConfig, AddressFieldKey } from '../services/address-data.service';

@Component({
  selector: 'app-dispatch-registration',
  templateUrl: './dispatch-registration.component.html',
  styleUrls: ['./dispatch-registration.component.scss']
})
export class DispatchRegistrationComponent implements OnInit {
  registrationForm: FormGroup;
  isSubmitting = false;
  readonly countryOptions = this.addressData.getCountries();
  activeFields: AddressFieldConfig[] = [];
  regions: string[] = [];
  states: string[] = [];
  cities: string[] = [];
  suburbs: string[] = [];

  constructor(
    private readonly fb: FormBuilder,
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly uiFeedback: UiFeedbackService,
    private readonly loadingService: LoadingService,
    private readonly modalControlService: ModalControlService,
    private readonly addressData: AddressDataService
  ) {
    this.registrationForm = this.fb.group({
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^\+?[0-9]{7,15}$/)]],
      pin: ['', [Validators.required, Validators.minLength(6)]],
      country: ['', Validators.required],
      region: [''],
      state: [''],
      city: [''],
      suburb: [''],
      localGovernment: [''],
      street: [''],
      isCompany: [false],
      companyName: [''],
      vehicleTypes: ['', Validators.required],
      plateNumber: [''],
      operatingAreas: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    const defaultCountry = this.getCountryFromLocale();
    if (defaultCountry) {
      this.registrationForm.patchValue({ country: defaultCountry });
      this.onCountryChange();
    }
  }

  async submit(): Promise<void> {
    if (this.registrationForm.invalid || this.isSubmitting) {
      this.registrationForm.markAllAsTouched();
      this.uiFeedback.error('Complete all required fields.');
      return;
    }

    this.isSubmitting = true;
    await this.loadingService.show('Creating dispatch account...');
    const value = this.registrationForm.value;

    const payload = {
      username: value.username,
      email: value.email,
      phoneNumber: value.phoneNumber,
      password: value.pin,
      roles: ['dispatch'],
      country: value.country,
      region: value.region,
      state: value.state,
      city: value.city,
      suburb: value.suburb,
      localGovernment: value.localGovernment,
      street: value.street,
      dispatchProfile: {
        isCompany: !!value.isCompany,
        companyName: value.companyName || '',
        vehicleTypes: String(value.vehicleTypes || '')
          .split(',')
          .map((entry: string) => entry.trim())
          .filter(Boolean),
        plateNumber: value.plateNumber || '',
        operatingAreas: String(value.operatingAreas || '')
          .split(',')
          .map((entry: string) => entry.trim())
          .filter(Boolean),
        isAvailable: true,
        verificationStatus: 'pending'
      }
    };

    this.http.post(`${environment.apiUrl}/auth/register`, payload).subscribe({
      next: async () => {
        await this.loadingService.hide();
        this.uiFeedback.success('Dispatch account created.');
        const prefill = {
          username: value.username,
          password: value.pin,
          auto: true
        };
        this.modalControlService.openSuccessModal({
          category: 'dispatch',
          ctaLabel: 'Continue to My Profile',
          autoLoginPrefill: prefill
        });
        this.isSubmitting = false;
      },
      error: async (error) => {
        await this.loadingService.hide();
        this.uiFeedback.error(error?.error?.message || 'Registration failed.');
        this.isSubmitting = false;
      }
    });
  }

  onCountryChange(): void {
    const country = this.registrationForm.get('country')?.value || '';
    this.activeFields = this.addressData.getFieldConfig(country);
    this.regions = this.addressData.getRegions(country);
    this.states = this.addressData.getStates(country);
    this.cities = [];
    this.suburbs = [];
    this.registrationForm.patchValue({
      region: '',
      state: '',
      city: '',
      suburb: '',
      localGovernment: '',
      street: ''
    });
    this.applyFieldRules();
  }

  onRegionOrStateChange(): void {
    const country = this.registrationForm.get('country')?.value || '';
    const locator = this.registrationForm.get('state')?.value || this.registrationForm.get('region')?.value || '';
    this.cities = this.addressData.getCities(country, locator);
    this.suburbs = [];
    this.registrationForm.patchValue({ city: '', suburb: '' });
  }

  onCityChange(): void {
    const country = this.registrationForm.get('country')?.value || '';
    const locator = this.registrationForm.get('state')?.value || this.registrationForm.get('region')?.value || '';
    const city = this.registrationForm.get('city')?.value || '';
    this.suburbs = this.addressData.getSuburbs(country, locator, city);
    this.registrationForm.patchValue({ suburb: '' });
  }

  isFieldActive(key: AddressFieldKey): boolean {
    return this.activeFields.some((field) => field.key === key);
  }

  isSelectField(key: AddressFieldKey): boolean {
    return this.activeFields.find((field) => field.key === key)?.type === 'select';
  }

  isRequiredField(key: AddressFieldKey): boolean {
    return this.activeFields.find((field) => field.key === key)?.required !== false;
  }

  getFieldLabel(key: AddressFieldKey, fallback: string): string {
    return this.activeFields.find((field) => field.key === key)?.label || fallback;
  }

  private applyFieldRules(): void {
    const allFields: AddressFieldKey[] = ['region', 'state', 'city', 'suburb', 'localGovernment', 'street'];
    allFields.forEach((field) => {
      const control = this.registrationForm.get(field);
      if (!control) return;
      if (this.isFieldActive(field) && this.isRequiredField(field)) {
        control.setValidators([Validators.required]);
      } else if (this.isFieldActive(field)) {
        control.clearValidators();
      } else {
        control.clearValidators();
        control.setValue('');
      }
      control.updateValueAndValidity({ emitEvent: false });
    });
  }

  private getCountryFromLocale(): string {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const map: Record<string, string> = {
      'Africa/Lagos': 'Nigeria',
      'Africa/Accra': 'Ghana',
      'Africa/Johannesburg': 'South Africa',
      'Africa/Nairobi': 'Kenya',
      'America/New_York': 'United States',
      'America/Chicago': 'United States',
      'America/Denver': 'United States',
      'America/Los_Angeles': 'United States',
      'Europe/London': 'United Kingdom',
      'Europe/Paris': 'France',
      'Europe/Rome': 'Italy'
    };
    return map[tz] || '';
  }
}

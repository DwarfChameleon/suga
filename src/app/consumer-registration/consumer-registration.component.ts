import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalControlService } from '../services/modal-control.service';
import { LoaderService } from '../services/loader.service';
import { AuthService } from '../services/authservice.service';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';
import { UiFeedbackService } from '../services/ui-feedback.service';
import { LoadingService } from '../services/loading.service';
import { AddressDataService, AddressFieldKey } from '../services/address-data.service';

@Component({
  selector: 'app-consumer-registration',
  templateUrl: './consumer-registration.component.html',
  styleUrls: ['./consumer-registration.component.scss'],
})
export class ConsumerRegistrationComponent implements OnInit {
  registrationForm!: FormGroup;
  invalidFormMessage = '';
  errorMessage = '';
  isSubmitting = false;
  currentStep = 2;
  readonly countryOptions = this.addressData.getCountries();
  activeFields: Array<{ key: AddressFieldKey; label: string; type: 'select' | 'text' }> = [];
  regions: string[] = [];
  states: string[] = [];
  cities: string[] = [];

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly modalControlService: ModalControlService,
    public readonly loaderService: LoaderService,
    private readonly authService: AuthService,
    private readonly uiFeedback: UiFeedbackService,
    private readonly loadingService: LoadingService,
    private readonly addressData: AddressDataService
  ) {
    this.registrationForm = this.formBuilder.group({
      username: ['', Validators.required],
      country: ['', Validators.required],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^\+?[0-9]{7,15}$/)]],
      email: ['', [Validators.required, Validators.email]],
      pin: ['', [Validators.required, Validators.minLength(6)]],
      region: [''],
      state: [''],
      city: [''],
      suburb: [''],
      localGovernment: [''],
      street: ['']
    });
  }

  async submitForm(): Promise<void> {
    if (this.isSubmitting) {
      return;
    }

    if (!this.registrationForm.valid) {
      this.registrationForm.markAllAsTouched();
      this.invalidFormMessage = 'Please complete the required fields.';
      this.uiFeedback.error(this.invalidFormMessage);
      return;
    }

    this.isSubmitting = true;
    await this.loadingService.show('Creating account...');
    const formData = this.registrationForm.value;

    this.http.post(`${environment.apiUrl}/auth/register`, {
      ...formData,
      password: formData.pin,
      roles: ['consumer']
    }).subscribe(
      () => {
        this.uiFeedback.success('Registration successful.');
        this.loadingService.hide();
        this.isSubmitting = false;
        const prefill = {
          username: formData.username,
          password: formData.pin,
          auto: true
        };
        this.modalControlService.openSuccessModal({
          category: 'consumer',
          autoRedirectTo: '/login',
          autoRedirectDelayMs: 5000,
          ctaLabel: 'Continue to Login',
          autoLoginPrefill: prefill
        });
      },
      (error) => {
        console.error('Error sending form data:', error);
        this.errorMessage = error?.error?.message || 'An error occurred. Please try again later.';
        this.uiFeedback.error(this.errorMessage);
        this.loadingService.hide();
        this.isSubmitting = false;
      }
    );
  }

  onGoogleAuthenticated(response: any): void {
    this.uiFeedback.success('Signed in with Google successfully.');
    const rolesRaw = response?.user?.roles ?? [];
    const roles = Array.isArray(rolesRaw) ? rolesRaw : [rolesRaw];
    if (roles.includes('chef')) {
      this.router.navigate(['/components/chef']);
      return;
    }
    this.router.navigate(['/components/consumer']);
  }

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['components/explore']);
      return;
    }
    const defaultCountry = this.getCountryFromLocale();
    if (defaultCountry) {
      this.registrationForm.patchValue({ country: defaultCountry });
      this.onCountryChange();
    }
  }

  onCountryChange(): void {
    const country = this.registrationForm.get('country')?.value || '';
    this.activeFields = this.addressData.getFieldConfig(country);
    this.regions = this.addressData.getRegions(country);
    this.states = this.addressData.getStates(country);
    this.cities = [];
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
    this.registrationForm.patchValue({ city: '' });
  }

  isFieldActive(key: AddressFieldKey): boolean {
    return this.activeFields.some((f) => f.key === key);
  }

  isSelectField(key: AddressFieldKey): boolean {
    return this.activeFields.find((f) => f.key === key)?.type === 'select';
  }

  getFieldLabel(key: AddressFieldKey, fallback: string): string {
    return this.activeFields.find((f) => f.key === key)?.label || fallback;
  }

  goToStep(step: number): void {
    if (step === 2) {
      this.currentStep = 2;
      return;
    }
    if (step === 3 && this.isStepTwoValid()) {
      this.invalidFormMessage = '';
      this.currentStep = 3;
      return;
    }
    this.invalidFormMessage = 'Complete country and location details first.';
  }

  isStepTwoValid(): boolean {
    const countryValid = !!this.registrationForm.get('country')?.value;
    if (!countryValid) return false;
    return this.activeFields.every((field) => {
      const control = this.registrationForm.get(field.key);
      return !control?.validator || !!String(control?.value || '').trim();
    });
  }

  private applyFieldRules(): void {
    const allFields: AddressFieldKey[] = ['region', 'state', 'city', 'suburb', 'localGovernment', 'street'];
    allFields.forEach((field) => {
      const control = this.registrationForm.get(field);
      if (!control) return;
      if (this.isFieldActive(field)) {
        control.setValidators([Validators.required]);
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
      'Europe/Rome': 'Italy',
    };
    return map[tz] || '';
  }
}

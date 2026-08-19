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
import { AddressDataService, AddressFieldConfig, AddressFieldKey } from '../services/address-data.service';
import { PhoneVerificationProof, PhoneVerificationService } from '../services/phone-verification.service';
import { isValidInternationalPhone, normalizeInternationalPhone, phoneDigits, stripDialCode } from '../utils/phone-number';
import { AccountReadinessService } from '../services/account-readiness.service';

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
  activeFields: AddressFieldConfig[] = [];
  regions: string[] = [];
  states: string[] = [];
  cities: string[] = [];
  suburbs: string[] = [];
  readonly requiresPhoneVerification = this.phoneVerification.isNativeSupported();
  phoneVerificationState: 'idle' | 'sending' | 'codeSent' | 'verified' = 'idle';
  phoneVerificationCode = '';
  phoneVerificationError = '';
  phoneVerificationProof: PhoneVerificationProof | null = null;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly modalControlService: ModalControlService,
    public readonly loaderService: LoaderService,
    private readonly authService: AuthService,
    private readonly uiFeedback: UiFeedbackService,
    private readonly loadingService: LoadingService,
    private readonly addressData: AddressDataService,
    private readonly phoneVerification: PhoneVerificationService,
    private readonly accountReadiness: AccountReadinessService
  ) {
    this.registrationForm = this.formBuilder.group({
      country: ['', Validators.required],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^\+?[0-9()\-\s]{7,20}$/)]],
      email: ['', [Validators.required, Validators.email]],
      pin: ['', [Validators.required, Validators.minLength(6)]],
      region: [''],
      state: [''],
      city: [''],
      suburb: ['']
    });
  }

  get phoneDialCode(): string {
    return this.addressData.getDialCode(this.registrationForm.get('country')?.value || '');
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
    const normalizedPhoneNumber = this.toInternationalPhone(formData.phoneNumber);

    this.http.post(`${environment.apiUrl}/auth/register`, {
      ...formData,
      phoneNumber: normalizedPhoneNumber,
      phoneVerification: this.phoneVerificationProof,
      password: formData.pin,
      roles: ['consumer']
    }).subscribe(
      () => {
        this.uiFeedback.success('Registration successful.');
        this.loadingService.hide();
        this.isSubmitting = false;
        const prefill = {
          username: formData.email,
          password: formData.pin,
          auto: true
        };
        this.modalControlService.openSuccessModal({
          category: 'consumer',
          ctaLabel: 'Continue to My Profile',
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
    this.accountReadiness.promptIfNeeded(response?.user, 'registration');
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
    this.suburbs = [];
    this.registrationForm.patchValue({
      region: '',
      state: '',
      city: '',
      suburb: ''
    });
    this.applyFieldRules();
    this.keepPhoneLocal();
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
    return this.activeFields.some((f) => f.key === key);
  }

  isSelectField(key: AddressFieldKey): boolean {
    return this.activeFields.find((f) => f.key === key)?.type === 'select';
  }

  onPhoneNumberChange(): void {
    this.keepPhoneLocal();
    if (!this.phoneVerificationProof) {
      return;
    }
    const currentPhone = this.toInternationalPhone(this.registrationForm.get('phoneNumber')?.value || '');
    if (phoneDigits(currentPhone) !== phoneDigits(this.phoneVerificationProof.phoneNumber)) {
      this.resetPhoneVerification();
    }
  }

  async startPhoneVerification(): Promise<void> {
    const phoneNumber = this.toInternationalPhone(this.registrationForm.get('phoneNumber')?.value || '');
    if (!isValidInternationalPhone(phoneNumber)) {
      this.phoneVerificationError = 'Enter a valid phone number before verification.';
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
        this.registrationForm.patchValue({ phoneNumber: stripDialCode(result.proof.phoneNumber, this.phoneDialCode) });
        this.uiFeedback.success('Phone number verified.');
      } else {
        this.phoneVerificationState = 'codeSent';
        this.registrationForm.patchValue({ phoneNumber: stripDialCode(phoneNumber, this.phoneDialCode) });
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
      this.registrationForm.patchValue({ phoneNumber: stripDialCode(proof.phoneNumber, this.phoneDialCode) });
      this.uiFeedback.success('Phone number verified.');
    } catch (error: any) {
      this.phoneVerificationError = error?.message || 'Verification code is invalid.';
      this.uiFeedback.error(this.phoneVerificationError);
    }
  }

  isRequiredField(key: AddressFieldKey): boolean {
    return this.activeFields.find((f) => f.key === key)?.required !== false;
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
      return field.required === false || !control?.validator || !!String(control?.value || '').trim();
    });
  }

  private applyFieldRules(): void {
    const allFields: AddressFieldKey[] = ['region', 'state', 'city', 'suburb', 'localGovernment', 'street'];
    allFields.forEach((field) => {
      const control = this.registrationForm.get(field);
      if (!control) return;
      if (['localGovernment', 'street'].includes(field)) {
        control.clearValidators();
        control.setValue('');
        control.updateValueAndValidity({ emitEvent: false });
        return;
      }
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
      'Europe/Rome': 'Italy',
    };
    return map[tz] || '';
  }

  private keepPhoneLocal(): void {
    const control = this.registrationForm.get('phoneNumber');
    if (!control) return;
    const current = String(control.value || '');
    const local = stripDialCode(current, this.phoneDialCode);
    if (current !== local) {
      control.setValue(local, { emitEvent: false });
    }
  }

  private resetPhoneVerification(): void {
    this.phoneVerificationProof = null;
    this.phoneVerificationCode = '';
    this.phoneVerificationError = '';
    this.phoneVerificationState = 'idle';
    this.phoneVerification.clearVerificationState();
  }

  private toInternationalPhone(value: string): string {
    return normalizeInternationalPhone(value, this.phoneDialCode);
  }
}

import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';
import { UiFeedbackService } from '../services/ui-feedback.service';
import { LoadingService } from '../services/loading.service';
import { ModalControlService } from '../services/modal-control.service';

@Component({
  selector: 'app-dispatch-registration',
  templateUrl: './dispatch-registration.component.html',
  styleUrls: ['./dispatch-registration.component.scss']
})
export class DispatchRegistrationComponent implements OnInit {
  registrationForm: FormGroup;
  isSubmitting = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly uiFeedback: UiFeedbackService,
    private readonly loadingService: LoadingService,
    private readonly modalControlService: ModalControlService
  ) {
    this.registrationForm = this.fb.group({
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^\+?[0-9]{7,15}$/)]],
      pin: ['', [Validators.required, Validators.minLength(6)]],
      country: ['', Validators.required],
      city: ['', Validators.required],
      isCompany: [false],
      companyName: [''],
      vehicleTypes: ['', Validators.required],
      plateNumber: [''],
      operatingAreas: ['', Validators.required]
    });
  }

  ngOnInit(): void {}

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
      city: value.city,
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
          autoRedirectTo: '/login',
          autoRedirectDelayMs: 5000,
          ctaLabel: 'Continue to Login',
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
}

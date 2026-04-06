import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DispatchService } from 'src/app/services/dispatch.service';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';

@Component({
  selector: 'app-dispatch-profile',
  templateUrl: './dispatch-profile.component.html',
  styleUrls: ['./dispatch-profile.component.scss']
})
export class DispatchProfileComponent implements OnInit {
  loading = true;
  saving = false;
  profile: any = null;
  form = {
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
    private readonly uiFeedback: UiFeedbackService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(event?: any): void {
    this.loading = true;
    this.dispatchService.getProfile().subscribe({
      next: (res) => {
        this.profile = res;
        const dp = res?.dispatchProfile || {};
        this.form = {
          isCompany: !!dp.isCompany,
          companyName: dp.companyName || '',
          vehicleTypes: Array.isArray(dp.vehicleTypes) ? dp.vehicleTypes.join(', ') : '',
          plateNumber: dp.plateNumber || '',
          licenseNumber: dp.licenseNumber || '',
          operatingAreas: Array.isArray(dp.operatingAreas) ? dp.operatingAreas.join(', ') : '',
          isAvailable: dp.isAvailable !== false
        };
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

  save(): void {
    if (this.saving) return;
    this.saving = true;
    const payload = {
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

    this.dispatchService.updateProfile(payload).subscribe({
      next: (res) => {
        this.profile = { ...this.profile, dispatchProfile: res?.dispatchProfile };
        this.saving = false;
        this.uiFeedback.success('Dispatch profile updated.');
        this.router.navigate(['/components/dispatch']);
      },
      error: (error) => {
        this.saving = false;
        this.uiFeedback.error(error?.error?.message || 'Profile update failed.');
      }
    });
  }
}

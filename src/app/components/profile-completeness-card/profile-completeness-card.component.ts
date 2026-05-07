import { Component, Input, OnChanges } from '@angular/core';
import { Router } from '@angular/router';

type UserRole = 'consumer' | 'chef' | 'dispatch' | 'admin' | string;

interface CompletionItem {
  label: string;
  complete: boolean;
}

@Component({
  selector: 'app-profile-completeness-card',
  templateUrl: './profile-completeness-card.component.html',
  styleUrls: ['./profile-completeness-card.component.scss']
})
export class ProfileCompletenessCardComponent implements OnChanges {
  @Input() profile: any;
  @Input() role: UserRole = 'consumer';
  @Input() ctaRoute = '/components/edit-profile';

  percent = 0;
  missingItems: string[] = [];
  completedItems: CompletionItem[] = [];

  constructor(private readonly router: Router) {}

  ngOnChanges(): void {
    this.computeCompleteness();
  }

  openProfile(): void {
    if (this.ctaRoute) {
      this.router.navigate([this.ctaRoute]);
    }
  }

  private computeCompleteness(): void {
    if (!this.profile) {
      this.percent = 0;
      this.missingItems = [];
      this.completedItems = [];
      return;
    }

    const roles = Array.isArray(this.profile?.roles) ? this.profile.roles.map((r: string) => r.toLowerCase()) : [];
    const role = String(this.role || roles[0] || 'consumer').toLowerCase();
    const profile = this.profile || {};
    const dispatchProfile = profile.dispatchProfile || {};

    const baseChecks: CompletionItem[] = [
      { label: 'Username', complete: this.hasValue(profile.username) },
      { label: 'Email', complete: this.hasValue(profile.email) },
      { label: 'Email verified', complete: !!profile.emailVerified },
      { label: 'Phone', complete: this.hasValue(profile.phoneNumber) },
      { label: 'Country', complete: this.hasValue(profile.country) },
      { label: 'State/Region', complete: this.hasValue(profile.state) || this.hasValue(profile.region) },
      { label: 'City', complete: this.hasValue(profile.city) },
      { label: 'Profile photo', complete: this.hasValue(profile.profilePicture) }
    ];

    const chefChecks: CompletionItem[] = [
      { label: 'Cover photo', complete: this.hasValue(profile.coverPicture) },
      { label: 'Restaurant address', complete: this.hasValue(profile.restaurantAddress) }
    ];

    const dispatchChecks: CompletionItem[] = [
      { label: 'Vehicle type', complete: Array.isArray(dispatchProfile.vehicleTypes) && dispatchProfile.vehicleTypes.length > 0 },
      { label: 'Plate number', complete: this.hasValue(dispatchProfile.plateNumber) },
      { label: 'License number', complete: this.hasValue(dispatchProfile.licenseNumber) },
      { label: 'Operating areas', complete: Array.isArray(dispatchProfile.operatingAreas) && dispatchProfile.operatingAreas.length > 0 }
    ];

    let checks = [...baseChecks];
    if (role === 'chef') checks = checks.concat(chefChecks);
    if (role === 'dispatch') checks = checks.concat(dispatchChecks);

    const completed = checks.filter((item) => item.complete).length;
    this.percent = checks.length ? Math.round((completed / checks.length) * 100) : 0;
    this.missingItems = checks.filter((item) => !item.complete).map((item) => item.label);
    this.completedItems = checks;
  }

  private hasValue(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
  }
}

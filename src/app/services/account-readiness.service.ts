import { Injectable } from '@angular/core';
import { UiFeedbackService } from './ui-feedback.service';

@Injectable({
  providedIn: 'root'
})
export class AccountReadinessService {
  private lastPromptKey = '';

  constructor(private readonly uiFeedback: UiFeedbackService) {}

  promptIfNeeded(user: any, source: 'login' | 'registration' = 'login'): void {
    if (!user) return;
    const missing: string[] = [];
    if (!user.emailVerified) missing.push('verify your email');
    if (!user.phoneVerified && !user.phoneVerification?.verifiedAt) missing.push('verify your phone');
    if (!missing.length) return;

    const key = `${user._id || user.email || 'user'}:${source}:${new Date().toDateString()}`;
    if (this.lastPromptKey === key) return;
    this.lastPromptKey = key;

    const intro = source === 'registration'
      ? 'Account created. To complete your profile, '
      : 'To complete your profile, ';
    void this.uiFeedback.success(`${intro}${missing.join(' and ')} when you can.`);
  }
}

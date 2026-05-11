import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/authservice.service';
import { LoadingService } from '../services/loading.service';
import { UiFeedbackService } from '../services/ui-feedback.service';
import { AccountReadinessService } from '../services/account-readiness.service';

@Component({
  selector: 'app-success',
  templateUrl: './success.page.html',
  styleUrls: ['./success.page.scss'],
})
export class SuccessPage implements OnInit, OnDestroy {
  @Input() registrationSuccess!: boolean;
  @Input() userCategory?: string;
  @Input() autoRedirectTo?: string;
  @Input() autoRedirectDelayMs?: number;
  @Input() ctaLabel?: string;
  @Input() autoLoginPrefill?: { username?: string; password?: string; auto?: boolean };

  isContinuing = false;
  private redirectTimer?: number;

  constructor(
    private router: Router,
    private modalController: ModalController,
    private authService: AuthService,
    private loadingService: LoadingService,
    private uiFeedback: UiFeedbackService,
    private accountReadiness: AccountReadinessService
  ) {}

  ngOnInit(): void {
    if (this.autoRedirectTo) {
      const delay = Number(this.autoRedirectDelayMs || 5000);
      this.redirectTimer = window.setTimeout(() => {
        this.navigateTo(this.autoRedirectTo as string);
      }, Math.max(0, delay));
    }
  }

  ngOnDestroy(): void {
    if (this.redirectTimer) {
      window.clearTimeout(this.redirectTimer);
    }
  }

  async continue(): Promise<void> {
    if (this.isContinuing) {
      return;
    }

    if (this.autoLoginPrefill?.username && this.autoLoginPrefill?.password) {
      this.isContinuing = true;
      await this.loadingService.show('Signing you in...');
      try {
        const response = await firstValueFrom(
          this.authService.login(this.autoLoginPrefill.username, this.autoLoginPrefill.password)
        );
        await this.loadingService.hide();
        this.accountReadiness.promptIfNeeded(response?.user, 'registration');
        await this.dismissSelf();
        this.redirectAfterLogin(response);
      } catch (error) {
        await this.loadingService.hide();
        this.isContinuing = false;
        this.uiFeedback.error('Account created, but automatic sign-in failed. Please sign in manually.');
      }
      return;
    }

    if (this.autoRedirectTo) {
      await this.navigateTo(this.autoRedirectTo);
      return;
    }
    await this.navigateTo('/components/explore');
  }

  private async navigateTo(url: string): Promise<void> {
    await this.dismissSelf();
    this.router.navigateByUrl(url, { replaceUrl: true });
  }

  private async dismissSelf(): Promise<void> {
    try {
      const top = await this.modalController.getTop();
      if (top) {
        await top.dismiss();
      } else {
        await this.modalController.dismiss();
      }
    } catch (err) {
      // ignore if not opened as a modal
    }
  }

  private redirectAfterLogin(response: any): void {
    const rolesRaw = response?.user?.roles ?? [];
    const roles = Array.isArray(rolesRaw) ? rolesRaw : [rolesRaw];
    const target = roles.includes('chef')
      ? '/components/chef'
      : roles.includes('dispatch')
        ? '/components/dispatch'
        : '/components/consumer';

    this.router.navigateByUrl(target, { replaceUrl: true });
  }

  refresh(event: any): void {
    const refresher = event?.target as HTMLIonRefresherElement | null;
    setTimeout(() => {
      refresher?.complete();
      window.location.reload();
    }, 400);
  }
}

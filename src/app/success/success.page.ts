import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';

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

  private redirectTimer?: number;

  constructor(private router: Router, private modalController: ModalController) {}

  ngOnInit(): void {
    if (this.autoLoginPrefill) {
      sessionStorage.setItem('suga-login-prefill', JSON.stringify(this.autoLoginPrefill));
    }

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

  continue(): void {
    if (this.autoRedirectTo) {
      this.navigateTo(this.autoRedirectTo);
      return;
    }
    this.router.navigate(['/components/explore']);
  }

  private async navigateTo(url: string): Promise<void> {
    try {
      await this.modalController.dismiss();
    } catch (err) {
      // ignore if not opened as a modal
    }
    this.router.navigateByUrl(url, { replaceUrl: true });
  }

  refresh(event: any): void {
    const refresher = event?.target as HTMLIonRefresherElement | null;
    setTimeout(() => {
      refresher?.complete();
      window.location.reload();
    }, 400);
  }
}

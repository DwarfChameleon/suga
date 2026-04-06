import { Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { SuccessPage } from '../success/success.page';

@Injectable({
  providedIn: 'root',
})
export class ModalControlService {

  constructor(private modalCtrl: ModalController) {}

  /** Open success modal with explicit data */
  async openSuccessModal(options?: {
    category?: string;
    autoRedirectTo?: string;
    autoRedirectDelayMs?: number;
    ctaLabel?: string;
    autoLoginPrefill?: { username?: string; password?: string; auto?: boolean };
  }) {
    const modal = await this.modalCtrl.create({
      component: SuccessPage,
      componentProps: {
        registrationSuccess: true,
        userCategory: options?.category,
        autoRedirectTo: options?.autoRedirectTo,
        autoRedirectDelayMs: options?.autoRedirectDelayMs,
        ctaLabel: options?.ctaLabel,
        autoLoginPrefill: options?.autoLoginPrefill
      },
      backdropDismiss: false
    });

    await modal.present();
    return modal;
  }

}

import { Injectable } from '@angular/core';
import { AlertController, ModalController } from '@ionic/angular';
import { LoginModalComponent } from '../login-modal/login-modal.component';

@Injectable({
  providedIn: 'root'
})
export class AuthAlertService {

  constructor(
    private alertCtrl: AlertController,
    private modalCtrl: ModalController
  ) {}

  async showLoginRequired(returnUrl?: string) {
    const alert = await this.alertCtrl.create({
      header: 'Login Required',
      message: 'You must be logged in to access this feature.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Login',
          handler: () => this.openLoginModal(returnUrl)
        }
      ],
      backdropDismiss: false
    });

    await alert.present();
  }

  private async openLoginModal(returnUrl?: string) {
    const modal = await this.modalCtrl.create({
      component: LoginModalComponent,
      componentProps: { returnUrl },
      backdropDismiss: false
    });

    await modal.present();
  }
}

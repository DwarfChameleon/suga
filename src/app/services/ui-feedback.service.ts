import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class UiFeedbackService {
  private isShowing = false;

  constructor(private toastController: ToastController) {}

  async error(message: string): Promise<void> {
    if (this.isShowing) return;
    this.isShowing = true;
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'top',
      cssClass: 'suga-error-toast'
    });
    await toast.present();
    toast.onDidDismiss().then(() => { this.isShowing = false; });
  }

  async success(message: string): Promise<void> {
    if (this.isShowing) return;
    this.isShowing = true;
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      position: 'top',
      cssClass: 'suga-success-toast'
    });
    await toast.present();
    toast.onDidDismiss().then(() => { this.isShowing = false; });
  }
}

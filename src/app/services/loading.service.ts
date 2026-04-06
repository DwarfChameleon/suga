import { Injectable } from '@angular/core';
import { LoadingController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loading?: HTMLIonLoadingElement;

  constructor(private loadingController: LoadingController) {}

  async show(message = 'Please wait...'): Promise<void> {
    if (this.loading) return;
    this.loading = await this.loadingController.create({
      message,
      spinner: 'crescent',
      backdropDismiss: false
    });
    await this.loading.present();
  }

  async hide(): Promise<void> {
    if (!this.loading) return;
    await this.loading.dismiss();
    this.loading = undefined;
  }
}

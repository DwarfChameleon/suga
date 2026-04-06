import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { LoginModalComponent } from '../login-modal/login-modal.component';
import { TokenStorageService } from '../services/token-storage.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {

  private isModalOpen = false;
  private prefill?: { username?: string; password?: string; auto?: boolean };

  constructor(
    private modalController: ModalController,
    private router: Router,
    private tokenStorage: TokenStorageService
  ) { }

  ngOnInit() {
    const statePrefill = (history?.state && history.state.prefill) ? history.state.prefill : null;
    const stored = sessionStorage.getItem('suga-login-prefill');
    const storedPrefill = stored ? JSON.parse(stored) : null;
    this.prefill = statePrefill || storedPrefill || undefined;
    if (this.prefill) {
      sessionStorage.removeItem('suga-login-prefill');
    }
    this.openLoginModal();
  }

  refresh(event: any): void {
    const refresher = event?.target as HTMLIonRefresherElement | null;
    setTimeout(() => {
      refresher?.complete();
      window.location.reload();
    }, 400);
  }

  private async openLoginModal(): Promise<void> {
    if (this.isModalOpen) return;
    this.isModalOpen = true;

    const modal = await this.modalController.create({
      component: LoginModalComponent,
      backdropDismiss: false,
      componentProps: {
        prefill: this.prefill
      }
    });

    modal.onDidDismiss().then(() => {
      this.isModalOpen = false;
      const isLoggedIn = !!this.tokenStorage.getAccessToken();
      if (!isLoggedIn) {
        this.router.navigateByUrl('/folder/inbox', { replaceUrl: true });
      }
    });

    await modal.present();
  }

}

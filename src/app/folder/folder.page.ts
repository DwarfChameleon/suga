import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { LoginModalComponent } from '../login-modal/login-modal.component';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/authservice.service';
import { Router } from '@angular/router';
import { TokenStorageService } from '../services/token-storage.service';
@Component({
  selector: 'app-folder',
  templateUrl: './folder.page.html',
  styleUrls: ['./folder.page.scss'],
})
export class FolderPage implements OnInit {
  public folder!: string;
  userEmail: string | undefined;

  constructor(
    public modalController: ModalController,
    private activatedRoute: ActivatedRoute,
    private userService: UserService,
    private auth: AuthService,
    private tokenStorage: TokenStorageService,
    private route: Router
  ) {}

  ngOnInit(): void {
    this.folder = this.activatedRoute.snapshot.paramMap.get('id') as string;
    this.userEmail = this.userService.getUserEmail();
    if (this.auth.isLoggedIn()) {
      const roles = (this.tokenStorage.getRoles() || []).map((r) => String(r || '').toLowerCase());
      const dashboard = roles.includes('chef')
        ? '/components/chef'
        : roles.includes('dispatch')
          ? '/components/dispatch'
        : roles.includes('consumer')
          ? '/components/consumer'
          : '/components/explore';
      this.route.navigateByUrl(dashboard, { replaceUrl: true });
    }
  }

  refresh(event: any): void {
    const refresher = event?.target as HTMLIonRefresherElement | null;
    setTimeout(() => {
      refresher?.complete();
      window.location.reload();
    }, 400);
  }

  async openLoginModal() {
    const modal = await this.modalController.create({
      component: LoginModalComponent,
      cssClass: 'login-modal-class',
      handle: true,
      initialBreakpoint: 1,
      breakpoints: [0, 0.92, 1]
    });
    return await modal.present();
  }
}

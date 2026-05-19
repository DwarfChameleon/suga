import { Component, OnDestroy, OnInit } from '@angular/core';
import { UserService } from './services/user.service';
import { Router } from '@angular/router';
import { TokenStorageService } from './services/token-storage.service';
import { MenuController, ModalController, ToastController } from '@ionic/angular';
import { LoginModalComponent } from './login-modal/login-modal.component';
import { NotificationService } from './services/notification.service';
import { NotificationSocketService } from './services/notification-socket.service';
import { Subscription } from 'rxjs';
import { SuggestedChefsComponent } from './components/suggested-chefs/suggested-chefs.component';
import { NetworkService } from './services/network.service';
import { UiFeedbackService } from './services/ui-feedback.service';
import { ThemeService } from './services/theme.service';
import { environment } from 'src/environments/environment';
import { NativeUiService } from './services/native-ui.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  public appPages = [
    { title: 'My Dashboard', url: '', icon: 'home' },
    { title: 'Explore', url: '/components/explore', icon: 'planet' },
    { title: 'Settings', url: '/components/profile-update', icon: 'settings' },
  ];
  userEmail: string | undefined;
  userName: string| undefined;
  userRoles: string | undefined;
  userRolesList: string[] = [];
  isLoggedIn: boolean = false;
  public labels = ['Kitchens', 'Delivery'];
  myAccountUrl: string|undefined;
  unreadCount: number = 0;
  private notificationsInitialized = false;
  private socketSub?: Subscription;
  private unreadSub?: Subscription;
  isOnline = true;
  isInternetOnline = true;
  private networkSub?: Subscription;
  private internetSub?: Subscription;
  private authSub?: Subscription;
  private suggestedChefsModalOpen = false;
  private suggestedChefsShownForUserId?: string;
  isBooting = true;

  constructor(
    private userService: UserService,
    private router: Router,
    private tokenStorage: TokenStorageService
  , private menuController: MenuController
  , private modalController: ModalController
  , private toastController: ToastController
  , private notificationService: NotificationService
  , private notificationSocket: NotificationSocketService
  , private networkService: NetworkService
  , private uiFeedback: UiFeedbackService
  , private themeService: ThemeService
  , private nativeUi: NativeUiService
  ) {}

  ngOnInit(): void {
    void this.nativeUi.initialize();
    window.setTimeout(() => {
      this.isBooting = false;
    }, 2800);
    this.themeService.apply(this.themeService.getSavedTheme());
    this.refreshUserState();
    this.authSub = this.tokenStorage.authState$.subscribe(() => {
      this.refreshUserState();
    });
    this.networkSub = this.networkService.online$.subscribe((online) => {
      this.isOnline = online;
    });

    this.internetSub = this.networkService.internet$.subscribe((online) => {
      if (this.isInternetOnline !== online) {
        this.isInternetOnline = online;
        if (!online) {
          this.uiFeedback.error('You are offline. Check your network connection.');
        } else {
          this.uiFeedback.success('Back online.');
        }
      } else {
        this.isInternetOnline = online;
      }
    });

  }
  async handleAccountClick(): Promise<void> {
    await this.closeMenu();
    this.refreshUserState();

    if (!this.isLoggedIn) {
      const modal = await this.modalController.create({
        component: LoginModalComponent,
              cssClass: 'login-modal-class',
      handle: true,
      initialBreakpoint: 1,
      breakpoints: [0, 0.92, 1],
        backdropDismiss: false
      });

      modal.onDidDismiss().then(() => {
        this.refreshUserState();
      });

      await modal.present();
      return;
    }

    if (this.isAdmin()) {
      await this.openAdminDashboard();
      return;
    }

    this.router.navigate([this.myAccountUrl || '/components/explore']);
  }

  private refreshUserState(): void {
    this.userEmail = this.userService.getUserEmail();
    this.userRolesList = this.tokenStorage.getRoles() || [];
    this.userRoles = this.userRolesList[0];
    this.userName = this.userService.getUserName();

    const token = this.tokenStorage.getAccessToken();
    this.isLoggedIn = !!token;

    if (this.isLoggedIn) {
      void this.nativeUi.syncPushRegistration();
      const roles = this.userRolesList.map((r) => String(r || '').toLowerCase());
      if (roles.includes('admin')) {
        this.myAccountUrl = '/components/explore';
      } else if (roles.includes('chef')) {
        this.myAccountUrl = '/components/chef';
      } else if (roles.includes('dispatch')) {
        this.myAccountUrl = '/components/dispatch';
      } else if (roles.includes('consumer')) {
        this.myAccountUrl = '/components/consumer';
      } else {
        this.myAccountUrl = '/components/explore';
      }

      this.userService.getSettings().subscribe({
        next: (settings) => {
          if (settings?.uiTheme) {
            this.themeService.apply(settings.uiTheme);
          }
        },
        error: () => {
          // Keep locally saved theme when settings call is unavailable.
        }
      });

      this.notificationService.loadInitial();
      if (token) {
        this.notificationSocket.connect(token);
        if (!this.notificationsInitialized) {
          this.socketSub = this.notificationSocket.notifications$.subscribe(n => {
            this.notificationService.addNotification(n);
            this.presentNotificationToast(n.title, n.message);
            void this.nativeUi.notifyDevice(n.title, n.message, { notificationId: n._id, type: n.type });
          });
          this.unreadSub = this.notificationService.getUnreadCount().subscribe(count => {
            this.unreadCount = count;
          });
          this.notificationsInitialized = true;
        }
      }

      this.maybeShowSuggestedChefs();
    } else {
      this.myAccountUrl = undefined;
      this.notificationSocket.disconnect();
      this.notificationService.clear();
      this.unreadCount = 0;
      this.notificationsInitialized = false;
      this.socketSub?.unsubscribe();
      this.unreadSub?.unsubscribe();
    }
  }

  private async maybeShowSuggestedChefs(): Promise<void> {
    const hide = localStorage.getItem('suga-hide-suggested-chefs') === 'true';
    if (hide) return;
    if (!this.isConsumer()) return;
    const userId = this.tokenStorage.getUserId() || '';
    if (!userId) return;
    if (this.suggestedChefsModalOpen) return;
    if (this.suggestedChefsShownForUserId === userId) return;

    this.suggestedChefsModalOpen = true;
    this.suggestedChefsShownForUserId = userId;
    const modal = await this.modalController.create({
      component: SuggestedChefsComponent,
      backdropDismiss: false
    });
    modal.onDidDismiss().then(() => {
      this.suggestedChefsModalOpen = false;
    });
    await modal.present();
  }

  private async presentNotificationToast(title: string, message: string): Promise<void> {
    const toast = await this.toastController.create({
      header: title,
      message,
      duration: 3500,
      position: 'top',
      cssClass: 'suga-notification-toast'
    });
    await toast.present();
  }


  logout(): void {
    this.tokenStorage.signOut();
    this.isLoggedIn = false;
    this.userEmail = undefined;
    this.userRoles = undefined;
    this.suggestedChefsModalOpen = false;
    this.suggestedChefsShownForUserId = undefined;
    this.notificationSocket.disconnect();
    this.notificationService.clear();
    this.router.navigate(['/login']); // Redirect to login page
  }

  // Close the side menu when a link is clicked
  async closeMenu() {
    try {
      await this.menuController.close();
    } catch (err) {
      // ignore
    }
  }

  async openSettings(): Promise<void> {
    await this.closeMenu();
    this.refreshUserState();
    if (!this.isLoggedIn) return;
    this.router.navigate(['/components/profile-update']);
  }

  isAdmin(): boolean {
    return this.userRolesList.map((r) => String(r || '').toLowerCase()).includes('admin');
  }

  isConsumer(): boolean {
    return this.userRolesList.map((r) => String(r || '').toLowerCase()).includes('consumer');
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
    this.networkSub?.unsubscribe();
    this.internetSub?.unsubscribe();
    this.socketSub?.unsubscribe();
    this.unreadSub?.unsubscribe();
  }

  isDispatch(): boolean {
    return this.userRolesList.map((r) => String(r || '').toLowerCase()).includes('dispatch');
  }

  async openAdminDashboard(): Promise<void> {
    await this.closeMenu();
    window.location.href = `${environment.baseUrl}/dashboard`;
  }
}

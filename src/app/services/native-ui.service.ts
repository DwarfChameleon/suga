import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { TokenStorageService } from './token-storage.service';

@Injectable({
  providedIn: 'root'
})
export class NativeUiService {
  private readonly isNativeApp = Capacitor.isNativePlatform();
  private initialized = false;
  private appIsActive = true;
  private pushListenersBound = false;
  private pushToken = '';

  constructor(
    private readonly http: HttpClient,
    private readonly tokenStorage: TokenStorageService
  ) {}

  async initialize(): Promise<void> {
    if (!this.isNativeApp || this.initialized) {
      return;
    }

    this.initialized = true;

    App.addListener('appStateChange', ({ isActive }) => {
      this.appIsActive = isActive;
    });

    try {
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setBackgroundColor({ color: '#3880FF' });
      await StatusBar.setStyle({ style: Style.Light });
    } catch {
      // Native polish should never block app boot.
    }

    await this.ensureNotificationPermission();
    await this.setupPushNotifications();

    window.setTimeout(() => {
      void this.hideSplash();
    }, 180);
  }

  async syncPushRegistration(): Promise<void> {
    if (!this.isNativeApp || !this.tokenStorage.getAccessToken()) {
      return;
    }
    await this.setupPushNotifications();
  }

  async notifyDevice(title: string, body: string, extra?: Record<string, unknown>): Promise<void> {
    if (!this.isNativeApp || this.appIsActive) {
      return;
    }

    const granted = await this.ensureNotificationPermission();
    if (!granted) {
      return;
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          id: Date.now() % 2147483000,
          title,
          body,
          smallIcon: 'ic_stat_suga',
          iconColor: '#3880FF',
          schedule: { at: new Date(Date.now() + 250) },
          extra
        }
      ]
    });
  }

  private async ensureNotificationPermission(): Promise<boolean> {
    if (!this.isNativeApp) {
      return false;
    }

    try {
      const permissions = await LocalNotifications.checkPermissions();
      if (permissions.display === 'granted') {
        return true;
      }

      const requested = await LocalNotifications.requestPermissions();
      return requested.display === 'granted';
    } catch {
      return false;
    }
  }

  private async setupPushNotifications(): Promise<void> {
    if (!this.isNativeApp) {
      return;
    }

    if (!this.pushListenersBound) {
      this.pushListenersBound = true;

      PushNotifications.addListener('registration', (token: Token) => {
        this.pushToken = String(token?.value || '').trim();
        if (this.pushToken) {
          void this.persistPushToken(this.pushToken);
        }
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.warn('Push registration failed:', error);
      });
    }

    try {
      const permissionState = await PushNotifications.checkPermissions();
      let receive = permissionState.receive;
      if (receive !== 'granted') {
        const requested = await PushNotifications.requestPermissions();
        receive = requested.receive;
      }
      if (receive !== 'granted') {
        return;
      }
      await PushNotifications.register();
      if (this.pushToken) {
        await this.persistPushToken(this.pushToken);
      }
    } catch (error) {
      console.warn('Push setup skipped:', error);
    }
  }

  private async persistPushToken(token: string): Promise<void> {
    if (!token || !this.tokenStorage.getAccessToken()) {
      return;
    }
    try {
      await firstValueFrom(this.http.post(`${environment.apiUrl}/notifications/device-token`, {
        token,
        platform: Capacitor.getPlatform()
      }));
    } catch (error) {
      console.warn('Saving push token failed:', error);
    }
  }

  private async hideSplash(): Promise<void> {
    try {
      await SplashScreen.hide({ fadeOutDuration: 180 });
    } catch {
      // Ignore when splash is already hidden.
    }
  }
}

import { AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone, OnDestroy, Output, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { AuthService } from 'src/app/services/authservice.service';
import { LoadingService } from 'src/app/services/loading.service';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';
import { environment } from 'src/environments/environment';

declare global {
  interface Window {
    google: any;
  }
}

@Component({
  selector: 'app-google-signin',
  templateUrl: './google-signin.component.html',
  styleUrls: ['./google-signin.component.scss']
})
export class GoogleSigninComponent implements AfterViewInit, OnDestroy {
  @Input() role: 'consumer' | 'chef' | 'dispatch' = 'consumer';
  @Input() context: 'login' | 'register' = 'login';
  @Output() authenticated = new EventEmitter<any>();
  @ViewChild('googleButtonContainer', { static: true }) googleButtonContainer!: ElementRef<HTMLDivElement>;

  private static gsiScriptPromise?: Promise<void>;
  private destroyed = false;
  readonly isNativeApp = Capacitor.isNativePlatform();

  constructor(
    private readonly authService: AuthService,
    private readonly loadingService: LoadingService,
    private readonly uiFeedback: UiFeedbackService,
    private readonly router: Router,
    private readonly zone: NgZone
  ) {}

  ngAfterViewInit(): void {
    this.initializeGoogleButton();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
  }

  private async initializeGoogleButton(): Promise<void> {
    if (this.isNativeApp) {
      return;
    }

    try {
      await this.loadGoogleScript();
      if (this.destroyed) return;

      const clientId = environment.googleClientId;
      if (!clientId) {
        this.uiFeedback.error('Google Sign-In is not configured.');
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: any) => {
          const credential = response?.credential;
          if (!credential) {
            this.uiFeedback.error('Google sign-in failed. Please try again.');
            return;
          }
          this.handleGoogleCredential(credential);
        }
      });

      this.googleButtonContainer.nativeElement.innerHTML = '';
      window.google.accounts.id.renderButton(this.googleButtonContainer.nativeElement, {
        type: 'standard',
        shape: 'pill',
        theme: 'outline',
        text: this.context === 'register' ? 'signup_with' : 'continue_with',
        size: 'large',
        width: 260
      });
    } catch (error) {
      console.error('Google script load failed:', error);
      this.uiFeedback.error('Unable to load Google sign-in.');
    }
  }

  showNativeGoogleHint(): void {
    this.uiFeedback.error('Google sign-in is not ready inside the APK yet. Please use email sign-up for now.');
  }

  private async handleGoogleCredential(idToken: string): Promise<void> {
    await this.loadingService.show('Signing in with Google...');

    this.authService.loginWithGoogle(idToken, [this.role]).subscribe({
      next: async (response) => {
        await this.loadingService.hide();
        this.authenticated.emit(response);
        if (this.authenticated.observers.length === 0) {
          this.redirectAfterLogin(response);
        }
      },
      error: async () => {
        await this.loadingService.hide();
        this.uiFeedback.error('Google authentication failed.');
      }
    });
  }

  private redirectAfterLogin(response: any): void {
    this.zone.run(() => {
      const rolesRaw = response?.user?.roles ?? [];
      const roles = Array.isArray(rolesRaw) ? rolesRaw : [rolesRaw];
      if (roles.includes('chef')) {
        this.router.navigate(['/components/chef']);
      } else if (roles.includes('dispatch')) {
        this.router.navigate(['/components/dispatch']);
      } else {
        this.router.navigate(['/components/consumer']);
      }
    });
  }

  private loadGoogleScript(): Promise<void> {
    if (window.google?.accounts?.id) {
      return Promise.resolve();
    }
    if (GoogleSigninComponent.gsiScriptPromise) {
      return GoogleSigninComponent.gsiScriptPromise;
    }

    GoogleSigninComponent.gsiScriptPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector('script[data-google-identity="true"]') as HTMLScriptElement | null;
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Identity script')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.setAttribute('data-google-identity', 'true');
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity script'));
      document.head.appendChild(script);
    });

    return GoogleSigninComponent.gsiScriptPromise;
  }
}

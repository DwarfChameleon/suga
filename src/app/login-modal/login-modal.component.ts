import { Component, OnInit, Input } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthService } from '../services/authservice.service';
import { TokenStorageService } from '../services/token-storage.service';
import { UiFeedbackService } from '../services/ui-feedback.service';
import { LoadingService } from '../services/loading.service';

@Component({
  selector: 'app-login-modal',
  templateUrl: './login-modal.component.html',
  styleUrls: ['./login-modal.component.scss'],
})
export class LoginModalComponent implements OnInit {

  @Input() returnUrl?: string;
  @Input() prefill?: { username?: string; password?: string; auto?: boolean };

  credentials = { username: '', password: '' };
  loginForm!: FormGroup;
  loginError?: string;
  isSubmitting = false;

  constructor(
    private modalCtrl: ModalController,
    private authService: AuthService,
    private tokenStorage: TokenStorageService,
    private router: Router,
    private fb: FormBuilder,
    private uiFeedback: UiFeedbackService,
    private loadingService: LoadingService
  ) {}

  ngOnInit() {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required],
    });

    if (this.prefill?.username || this.prefill?.password) {
      this.credentials.username = this.prefill?.username || '';
      this.credentials.password = this.prefill?.password || '';
      this.loginForm.patchValue({
        username: this.credentials.username,
        password: this.credentials.password
      });

      if (this.prefill?.auto) {
        setTimeout(() => {
          this.login();
        }, 50);
      }
    }
  }

  /** Close modal ONLY */
  async dismiss() {
    await this.modalCtrl.dismiss();
  }

  async goToRegistration(): Promise<void> {
    await this.modalCtrl.dismiss();
    await this.router.navigate(['/registration']);
  }

  async login() {
    if (this.loginForm.invalid || this.isSubmitting) return;

    this.isSubmitting = true;
    this.loginError = undefined;

    const { username, password } = this.credentials;
    await this.loadingService.show('Logging in...');

    this.authService.login(username, password).subscribe({
      next: async (response: any) => {
        this.tokenStorage.saveResponse(response);

        await this.loadingService.hide();
        await this.modalCtrl.dismiss();

        this.redirectAfterLogin(response);
        this.isSubmitting = false;
      },
      error: () => {
        this.loginError = 'Invalid credentials. Please try again.';
        this.uiFeedback.error(this.loginError);
        this.isSubmitting = false;
        this.loadingService.hide();
      }
    });
  }

  async onGoogleAuthenticated(response: any): Promise<void> {
    await this.modalCtrl.dismiss();
    this.redirectAfterLogin(response);
  }

  /** Single responsibility: routing AFTER login */
  private redirectAfterLogin(response: any) {
    if (this.returnUrl) {
      this.router.navigateByUrl(this.returnUrl, { replaceUrl: true });
      return;
    }

    const rolesRaw = response?.user?.roles ?? [];
    const roles = Array.isArray(rolesRaw) ? rolesRaw : [rolesRaw];

    if (roles.includes('chef')) {
      this.router.navigate(['/components/chef'], { replaceUrl: true });
    } else if (roles.includes('dispatch')) {
      this.router.navigate(['/components/dispatch'], { replaceUrl: true });
    } else {
      this.router.navigate(['/components/consumer'], { replaceUrl: true });
    }
  }
}

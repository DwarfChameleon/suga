import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
@Component({
  selector: 'app-registration',
  templateUrl: './registration.page.html',
  styleUrls: ['./registration.page.scss'],
})
export class RegistrationPage implements OnInit {
  constructor(private router: Router) { }
  activeInfoRole: 'consumer' | 'chef' | 'dispatch' | null = null;

  readonly roleInfo: Record<'consumer' | 'chef' | 'dispatch', string> = {
    consumer: 'For food lovers who want to discover nearby dishes, follow chefs, watch food stories, and place orders.',
    chef: 'For cooks, restaurants, and food brands who want to post dishes, share stories, receive orders, and build a following.',
    dispatch: 'For riders or delivery companies who want to receive open delivery jobs, update order progress, and earn from completed deliveries.'
  };

  selectRole(role: 'chef' | 'consumer' | 'dispatch') {
    if (role === 'chef') {
      this.router.navigate(['/chef-registration']);
    } else if (role === 'consumer') {
      this.router.navigate(['/consumer-registration']);
    } else if (role === 'dispatch') {
      this.router.navigate(['/dispatch-registration']);
    }
  }

  ngOnInit() {
  }

  toggleRoleInfo(role: 'consumer' | 'chef' | 'dispatch', event?: Event): void {
    event?.stopPropagation();
    this.activeInfoRole = this.activeInfoRole === role ? null : role;
  }

  refresh(event: any): void {
    const refresher = event?.target as HTMLIonRefresherElement | null;
    setTimeout(() => {
      refresher?.complete();
      window.location.reload();
    }, 400);
  }

}

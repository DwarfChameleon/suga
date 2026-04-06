import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
@Component({
  selector: 'app-registration',
  templateUrl: './registration.page.html',
  styleUrls: ['./registration.page.scss'],
})
export class RegistrationPage implements OnInit {
  constructor(private router: Router) { }
  activeRole: 'intro' | 'consumer' | 'chef' | 'dispatch' = 'intro';

  onSelectionChange(event: any) {
    const selectedValue = event?.detail?.value ?? event?.target?.value;
    this.selectRole(selectedValue);
  }

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

  onCarouselScroll(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const cardWidth = target.clientWidth * 0.82 + 16; // 82vw + gap
    const index = Math.round(target.scrollLeft / cardWidth);
    this.activeRole = (['intro', 'consumer', 'chef', 'dispatch'][index] as any) || 'intro';
  }

  refresh(event: any): void {
    const refresher = event?.target as HTMLIonRefresherElement | null;
    setTimeout(() => {
      refresher?.complete();
      window.location.reload();
    }, 400);
  }

}

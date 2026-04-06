import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
})
export class ForgotPasswordPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

  refresh(event: any): void {
    const refresher = event?.target as HTMLIonRefresherElement | null;
    setTimeout(() => {
      refresher?.complete();
      window.location.reload();
    }, 400);
  }

}

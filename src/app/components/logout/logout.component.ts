import { Component, OnInit } from '@angular/core';
import { LogoutService } from 'src/app/services/logout.service';
@Component({
  selector: 'app-logout',
  templateUrl: './logout.component.html',
  styleUrls: ['./logout.component.scss'],
})
export class LogoutComponent  implements OnInit {
  constructor(private logoutService: LogoutService) { }
 

  logout(): void {
    this.logoutService.logout().subscribe(
      () => {
        // Handle successful logout, such as clearing user data or redirecting to login page
      },
      (error) => {
        console.error('Logout failed:', error);
        // Handle logout failure, such as displaying an error message
      }
    );
  }

 ngOnInit(): void {
    throw new Error('Method not implemented.');
  }

}

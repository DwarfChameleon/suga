import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { TokenStorageService } from './token-storage.service';
import { AuthAlertService } from './auth-alert.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private tokenStorage: TokenStorageService,
    private router: Router,
    private authAlert: AuthAlertService
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const token = this.tokenStorage.getAccessToken();

    // 🚫 Not logged in
    if (!token) {
      this.authAlert.showLoginRequired(state.url);
      return false;
    }

    const expectedRoles: string[] =
      route.data['expectedRoles'] ||
      [route.data['expectedRole']].filter(Boolean);

    const userRoles = this.tokenStorage.getRoles();

    if (!expectedRoles.length || !userRoles) {
      this.router.navigate(['/components/unauthorized']);
      return false;
    }

    const allowed = expectedRoles
      .map(r => r.toLowerCase())
      .some(r => userRoles.map(u => u.toLowerCase()).includes(r));

    if (!allowed) {
      this.router.navigate(['/components/unauthorized']);
      return false;
    }

    return true;
  }
}

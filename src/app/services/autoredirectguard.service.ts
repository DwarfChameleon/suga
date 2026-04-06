import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from './authservice.service';
import { TokenStorageService } from './token-storage.service';

@Injectable({
  providedIn: 'root'
})
export class AutoredirectguardService implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router,
    private tokenStorage: TokenStorageService
  ) {}

  canActivate(): boolean | UrlTree {
    if (this.authService.isLoggedIn()) {
      const roles = (this.tokenStorage.getRoles() || []).map((r) => String(r || '').toLowerCase());
      if (roles.includes('chef')) {
        return this.router.parseUrl('/components/chef');
      }
      if (roles.includes('dispatch')) {
        return this.router.parseUrl('/components/dispatch');
      }
      if (roles.includes('consumer')) {
        return this.router.parseUrl('/components/consumer');
      }
      return this.router.parseUrl('/components/explore');
    }
    return true;
  }
}

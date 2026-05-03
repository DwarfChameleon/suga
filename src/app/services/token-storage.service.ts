import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
providedIn: 'root'
})
export class TokenStorageService {
private ACCESS_TOKEN_KEY = 'auth-access-token';
private REFRESH_TOKEN_KEY = 'auth-refresh-token';
private USER_KEY = 'auth-user';
private ROLES_KEY = 'user-roles';
private authStateSubject = new BehaviorSubject<boolean>(!!this.getStorage().getItem(this.ACCESS_TOKEN_KEY));
authState$ = this.authStateSubject.asObservable();

constructor() { }

private getStorage(): Storage {
  return Capacitor.isNativePlatform() ? localStorage : sessionStorage;
}

saveResponse(response: any): void {
  this.saveRefreshToken(response.refreshToken);
  this.saveUser(response.user);
  this.saveRoles(response.user?.roles || []); // Default to empty array if roles are not present
  this.saveAccessToken(response.accessToken);
}

saveAccessToken(token: string): void {
  this.getStorage().setItem(this.ACCESS_TOKEN_KEY, token);
  this.authStateSubject.next(true);
}

getAccessToken(): string | null {
  return this.getStorage().getItem(this.ACCESS_TOKEN_KEY);
}

saveRefreshToken(token: string): void {
  this.getStorage().setItem(this.REFRESH_TOKEN_KEY, token);
}

getRefreshToken(): string | null {
  return this.getStorage().getItem(this.REFRESH_TOKEN_KEY);
}

saveUser(user: any): void {
  this.getStorage().setItem(this.USER_KEY, JSON.stringify(user));
}

getUser(): any {
  const user = this.getStorage().getItem(this.USER_KEY);
  return user ? JSON.parse(user) : null;
}

saveRoles(roles: string[] | string | undefined): void {
  const normalizedRoles = this.normalizeRoles(roles);
  if (normalizedRoles.length > 0) {
    this.getStorage().setItem(this.ROLES_KEY, JSON.stringify(normalizedRoles));
  } else {
    this.getStorage().removeItem(this.ROLES_KEY);
  }
}

getRoles(): string[] {
  const roles = this.getStorage().getItem(this.ROLES_KEY);
  try {
    const parsed = roles ? JSON.parse(roles) : [];
    return this.normalizeRoles(parsed);
  } catch (e) {
    console.error('Error parsing roles from storage:', e);
    return [];
  }
}

private normalizeRoles(roles: unknown): string[] {
  if (!roles) return [];
  if (Array.isArray(roles)) {
    return roles.map(r => String(r));
  }
  if (typeof roles === 'string') {
    return [roles];
  }
  return [];
}

public getUserId(): string {
  const user = this.getUser();
  return user ? user._id : '';
}

clearTokens(): void {
  this.getStorage().removeItem(this.ACCESS_TOKEN_KEY);
  this.getStorage().removeItem(this.REFRESH_TOKEN_KEY);
  this.authStateSubject.next(false);
}

signOut(): void {
  this.clearTokens();
  this.getStorage().removeItem(this.USER_KEY);
  this.getStorage().removeItem(this.ROLES_KEY);
  this.authStateSubject.next(false);
}
}

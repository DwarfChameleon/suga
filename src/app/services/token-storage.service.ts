import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
providedIn: 'root'
})
export class TokenStorageService {
private ACCESS_TOKEN_KEY = 'auth-access-token';
private REFRESH_TOKEN_KEY = 'auth-refresh-token';
private USER_KEY = 'auth-user';
private ROLES_KEY = 'user-roles';
private authStateSubject = new BehaviorSubject<boolean>(!!localStorage.getItem(this.ACCESS_TOKEN_KEY));
authState$ = this.authStateSubject.asObservable();

constructor() { }

saveResponse(response: any): void {
  this.saveRefreshToken(response.refreshToken);
  this.saveUser(response.user);
  this.saveRoles(response.user?.roles || []); // Default to empty array if roles are not present
  this.saveAccessToken(response.accessToken);
}

saveAccessToken(token: string): void {
  localStorage.setItem(this.ACCESS_TOKEN_KEY, token);
  this.authStateSubject.next(true);
}

getAccessToken(): string | null {
  return localStorage.getItem(this.ACCESS_TOKEN_KEY);
}

saveRefreshToken(token: string): void {
  localStorage.setItem(this.REFRESH_TOKEN_KEY, token);
}

getRefreshToken(): string | null {
  return localStorage.getItem(this.REFRESH_TOKEN_KEY);
}

saveUser(user: any): void {
  localStorage.setItem(this.USER_KEY, JSON.stringify(user));
}

getUser(): any {
  const user = localStorage.getItem(this.USER_KEY);
  return user ? JSON.parse(user) : null;
}

saveRoles(roles: string[] | string | undefined): void {
  const normalizedRoles = this.normalizeRoles(roles);
  if (normalizedRoles.length > 0) {
    localStorage.setItem(this.ROLES_KEY, JSON.stringify(normalizedRoles));
  } else {
    localStorage.removeItem(this.ROLES_KEY);
  }
  console.log('Roles saved to localStorage:', normalizedRoles);
}

getRoles(): string[] {
  const roles = localStorage.getItem(this.ROLES_KEY);
  try {
    console.log('Roles retrieved from localStorage:', roles);
    const parsed = roles ? JSON.parse(roles) : [];
    return this.normalizeRoles(parsed);
  } catch (e) {
    console.error("Error parsing roles from localStorage:", e);
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
  localStorage.removeItem(this.ACCESS_TOKEN_KEY);
  localStorage.removeItem(this.REFRESH_TOKEN_KEY);
  this.authStateSubject.next(false);
}

signOut(): void {
  this.clearTokens();
  localStorage.removeItem(this.USER_KEY);
  localStorage.removeItem(this.ROLES_KEY);
  this.authStateSubject.next(false);
}
}

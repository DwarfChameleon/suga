import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { TokenStorageService } from './token-storage.service';
import { UserInfo } from '../interface/user-details';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private BASE_URL = `${environment.apiUrl}/auth`;
 
  apiUrl: any;

  constructor(private http: HttpClient, private tokenStorage: TokenStorageService) { }

  getUserDetails(): Observable<UserInfo> {
    const userId = this.tokenStorage.getUserId();
    if (!userId) {
      throw new Error('User ID is not available');
    }
    return this.http.get<UserInfo>(`${this.BASE_URL}/user/${userId}`);
  }
  
  login(username: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.BASE_URL}/login`, { username, password }).pipe(
      tap(response => this.tokenStorage.saveResponse(response)),
      catchError(error => throwError(error))
    );
  }

  loginWithGoogle(idToken: string, roles: string[] = ['consumer']): Observable<any> {
    return this.http.post<any>(`${this.BASE_URL}/google`, { idToken, roles }).pipe(
      tap(response => this.tokenStorage.saveResponse(response)),
      catchError(error => throwError(error))
    );
  }

  refreshToken(refreshToken?: string): Observable<any> {
    if (!refreshToken) {
      return throwError('No refresh token available');
    }

    return this.http.post<any>(`${this.BASE_URL}/refresh-token`, { token: refreshToken }).pipe(
      tap(response => {
        if (response?.accessToken) {
          this.tokenStorage.saveAccessToken(response.accessToken);
        }
      }),
      catchError(error => throwError(error))
    );
  }

 

  logout(): void {
    this.tokenStorage.signOut();
  }

  isLoggedIn(): boolean {
    return !!this.tokenStorage.getAccessToken();
  }
}

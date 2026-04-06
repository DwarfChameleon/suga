import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, take, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/authservice.service';
import { TokenStorageService } from '../services/token-storage.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

  constructor(public authService: AuthService, private tokenStorage: TokenStorageService) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    let authReq = req;
    const token = this.tokenStorage.getAccessToken();
    if (token != null) {
      authReq = this.addTokenHeader(req, token);
    } else {
      const refreshToken = this.tokenStorage.getRefreshToken();
      if (refreshToken && !req.url.includes('/auth/')) {
        return this.authService.refreshToken(refreshToken).pipe(
          switchMap((tokenResponse: any) => {
            if (tokenResponse?.accessToken) {
              this.tokenStorage.saveAccessToken(tokenResponse.accessToken);
              return next.handle(this.addTokenHeader(req, tokenResponse.accessToken));
            }
            return next.handle(req);
          }),
          catchError(() => next.handle(req))
        );
      }
    }

    return next.handle(authReq).pipe(
      catchError(error => {
        if (error instanceof HttpErrorResponse && !authReq.url.includes('auth/login') && error.status === 401) {
          return this.handle401Error(authReq, next);
        }

        return throwError(error);
      })
    );
  }

  private addTokenHeader(request: HttpRequest<any>, token: string) {
    let headers = request.headers.set('Authorization', 'Bearer ' + token);
    const refreshToken = this.tokenStorage.getRefreshToken();
    if (refreshToken) {
      headers = headers.set('x-refresh-token', refreshToken);
    }
    return request.clone({ headers });
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler) {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      const refreshToken = this.tokenStorage.getRefreshToken();
      if (refreshToken)
        return this.authService.refreshToken(refreshToken).pipe(
          switchMap((token: any) => {
            this.isRefreshing = false;
            this.tokenStorage.saveAccessToken(token.accessToken);
            this.refreshTokenSubject.next(token.accessToken);
            return next.handle(this.addTokenHeader(request, token.accessToken));
          }),
          catchError((err) => {
            this.isRefreshing = false;
            this.tokenStorage.signOut();
            return throwError(err);
          })
        );
    }

    return this.refreshTokenSubject.pipe(
      filter(token => token != null),
      take(1),
      switchMap((token) => next.handle(this.addTokenHeader(request, token)))
    );
  }
}

import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

@Injectable()
export class FallbackServerInterceptor implements HttpInterceptor {
  private readonly PRIMARY_URL = 'https://suga-server.onrender.com/api';
  private readonly FALLBACK_URL = 'http://localhost:5000/api';
  private readonly REQUEST_TIMEOUT_MS = 15000;

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.isFallbackEnabled() || !req.url.includes(this.PRIMARY_URL)) {
      return next.handle(req);
    }

    return next.handle(req).pipe(
      timeout(this.REQUEST_TIMEOUT_MS),
      catchError((err) => {
        if (err.status === 0 || err.name === 'TimeoutError') {
          const fallbackReq = req.clone({
            url: req.url.replace(this.PRIMARY_URL, this.FALLBACK_URL)
          });
          console.warn(`Production server failed (${err.status || 'timeout'}). Retrying against localhost...`);
          return next.handle(fallbackReq);
        }
        return throwError(() => err);
      })
    );
  }

  private isFallbackEnabled(): boolean {
    if (environment.production) {
      return false;
    }

    try {
      return localStorage.getItem('suga-enable-local-api-fallback') === 'true';
    } catch {
      return false;
    }
  }
}

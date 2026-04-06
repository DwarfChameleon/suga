import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { AppLogService } from './app-log.service';

@Injectable()
export class ErrorLoggingInterceptor implements HttpInterceptor {
  constructor(private appLog: AppLogService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((err: HttpErrorResponse) => {
        const message = `${req.method} ${req.url} -> ${err.status} ${err.statusText}`;
        this.appLog.error(message, { url: req.url, status: err.status, error: err.error });
        return throwError(() => err);
      })
    );
  }
}

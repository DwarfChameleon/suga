import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, of, timer } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class NetworkService {
  private internetSubject = new BehaviorSubject<boolean>(navigator.onLine);
  private serverSubject = new BehaviorSubject<boolean>(true);
  online$ = this.serverSubject.asObservable();
  internet$ = this.internetSubject.asObservable();
  private readonly healthUrl = `${environment.apiUrl}/health`;

  constructor(private zone: NgZone, private http: HttpClient) {
    window.addEventListener('online', () => {
      this.zone.run(() => this.internetSubject.next(true));
    });
    window.addEventListener('offline', () => {
      this.zone.run(() => this.internetSubject.next(false));
    });

    timer(0, 15000)
      .pipe(
        switchMap(() =>
          this.http.get(this.healthUrl).pipe(
            map(() => true),
            catchError(() => of(false))
          )
        )
      )
      .subscribe((serverUp) => {
        this.zone.run(() => this.serverSubject.next(serverUp));
      });
  }

  isOnline(): boolean {
    return this.serverSubject.value;
  }

  isInternetOnline(): boolean {
    return this.internetSubject.value;
  }
}

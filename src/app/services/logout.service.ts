// logout.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LogoutService {

  private signoutUrl = 'http://localhost:8080/api/auth/signout';

  constructor(private http: HttpClient) { }

  logout(): Observable<any> {
    return this.http.post(this.signoutUrl, {});
  }
}

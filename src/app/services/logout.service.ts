// logout.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LogoutService {

  private signoutUrl = `${environment.apiUrl}/auth/signout`;

  constructor(private http: HttpClient) { }

  logout(): Observable<any> {
    return this.http.post(this.signoutUrl, {});
  }
}

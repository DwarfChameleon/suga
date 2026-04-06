import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Order } from '../interface/order';
import { environment } from 'src/environments/environment';
import { TokenStorageService } from './token-storage.service';

@Injectable({
  providedIn: 'root',
})
export class UserDashboardService {
  private baseUrl = `${environment.apiUrl}`;

  constructor(private http: HttpClient, private tokenStorage: TokenStorageService) {}

  private getAuthHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${this.tokenStorage.getAccessToken()}`,
      'x-refresh-token': `${this.tokenStorage.getRefreshToken()}`
    });
  }

  getUserOrders(): Observable<Order[]> {
    const headers = this.getAuthHeaders();
    return this.http.get<Order[]>(`${this.baseUrl}/myOrders`, { headers });
  }

  confirmOrderReceipt(orderId: string, received: boolean): Observable<Order> {
    const headers = this.getAuthHeaders().set('Content-Type', 'application/json');
    return this.http.put<Order>(`${this.baseUrl}/order/${orderId}/consumer-confirm`, { received }, { headers });
  }
}

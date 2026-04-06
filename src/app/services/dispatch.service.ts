import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DispatchService {
  private readonly baseUrl = `${environment.apiUrl}/dispatch`;

  constructor(private readonly http: HttpClient) {}

  getDashboard(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/dashboard`);
  }

  getProfile(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/profile`);
  }

  updateProfile(payload: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/profile`, payload);
  }

  getAvailableOrders(limit = 30): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/available-orders?limit=${limit}`);
  }

  getOrdersByStatus(status: 'active' | 'completed' | 'available'): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/orders?status=${status}`);
  }

  getHistory(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/history`);
  }

  getAnalytics(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/analytics`);
  }

  getWalletSummary(): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/wallet/me`);
  }

  updateLocation(lat: number, lng: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/location`, { lat, lng });
  }

  acceptOrder(orderId: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/orders/${orderId}/accept`, {});
  }

  declineOrder(orderId: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/orders/${orderId}/decline`, {});
  }

  updateOrderStatus(orderId: string, dispatchStatus: string, note = '', qrToken?: string): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/orders/${orderId}/status`, { dispatchStatus, note, qrToken });
  }

  verifyDeliveryQr(orderId: string, token: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/order/${orderId}/qr/verify`, { token });
  }
}

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, Observable, throwError } from 'rxjs';
import { Order } from '../interface/order';
import { TokenStorageService } from './token-storage.service';
import { environment } from 'src/environments/environment';
import { CartItem } from './cart.service';

export interface BulkOrderResponse {
  orders: Order[];
  orderIds: string[];
  itemCount: number;
  subtotal: number;
  feeAmount: number;
  totalAmount: number;
  deliveryFee?: number;
}

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  [x: string]: any;
  private baseUrl = `${environment.apiUrl}/order`;

  constructor(private http: HttpClient, private tokenStorage: TokenStorageService) { }

createOrder(order: Partial<Order>): Observable<Order> {
  const token = this.tokenStorage.getAccessToken();

  const headers = new HttpHeaders({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  });

  return this.http.post<Order>(`${this.baseUrl}`, order, { headers });
}

createBulkOrders(items: CartItem[]): Observable<BulkOrderResponse> {
  const token = this.tokenStorage.getAccessToken();
  const headers = new HttpHeaders({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  });
  return this.http.post<BulkOrderResponse>(`${this.baseUrl}/bulk`, { items }, { headers });
}

createBulkOrdersWithLocation(items: CartItem[], location: { deliveryLat?: number; deliveryLng?: number; chefLat?: number; chefLng?: number }): Observable<BulkOrderResponse> {
  const token = this.tokenStorage.getAccessToken();
  const headers = new HttpHeaders({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  });
  return this.http.post<BulkOrderResponse>(`${this.baseUrl}/bulk`, { items, ...location }, { headers });
}

createGiftOrder(payload: any): Observable<Order> {
  const token = this.tokenStorage.getAccessToken();
  const headers = new HttpHeaders({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  });
  return this.http.post<Order>(`${this.baseUrl}/gift`, payload, { headers });
}

payOrderWithWalletOrTokens(payload: {
  orderId?: string;
  orderIds?: string[];
  method: 'wallet' | 'token' | 'split';
  tokenAmount?: number;
  walletAmount?: number;
}): Observable<any> {
  const token = this.tokenStorage.getAccessToken();
  const headers = new HttpHeaders({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  });
  return this.http.post(`${this.baseUrl}/pay`, payload, { headers });
}

  updateOrderStatus(orderId: string, status: string, options?: { dispatchRiderId?: string; autoAssign?: boolean; dispatchAssign?: boolean }): Observable<Order> {
    return this.http.put<Order>(`${this.baseUrl}/${orderId}/status`, {
      status,
      dispatchRiderId: options?.dispatchRiderId,
      autoAssign: options?.autoAssign,
      dispatchAssign: options?.dispatchAssign
    });
  }

  getUserOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.baseUrl}/myOrders`);
  }

  getChefOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.baseUrl}/chef`);
  }

  getOrderById(orderId: string): Observable<Order> {
      return this.http.get<Order>(`${this.baseUrl}/${orderId}`);
    }

  getAvailableDispatchRiders(orderId: string): Observable<{ riders: Array<{ _id: string; username: string; companyName: string; vehicleTypes: string[]; distanceKm: number | null }> }> {
    const query = orderId ? `?orderId=${orderId}` : '';
    return this.http.get<{ riders: Array<{ _id: string; username: string; companyName: string; vehicleTypes: string[]; distanceKm: number | null }> }>(
      `${environment.apiUrl}/dispatch/available-riders${query}`
    );
  }

  getOrderQr(orderId: string): Observable<{ token: string; readableCode: string; expiresAt: string; visibleToRider: boolean }> {
    return this.http.get<{ token: string; readableCode: string; expiresAt: string; visibleToRider: boolean }>(`${this.baseUrl}/${orderId}/qr`);
  }

  revealOrderQr(orderId: string): Observable<{ message: string; token: string; readableCode: string; expiresAt: string; visibleToRider: boolean }> {
    return this.http.post<{ message: string; token: string; readableCode: string; expiresAt: string; visibleToRider: boolean }>(`${this.baseUrl}/${orderId}/qr/reveal`, {});
  }

  verifyOrderQr(orderId: string, token: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${orderId}/qr/verify`, { token });
  }

  submitOrderRating(orderId: string, stars: number, comment?: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${orderId}/rating`, { stars, comment });
  }

  // completed-count endpoint returns an object like { count: number }
  countOrders(food_id: string): Observable<{ count: number }>{
      return this.http.get<{ count: number }>(`${environment.apiUrl}/completed-count/${food_id}`).pipe(
      catchError(error =>{
        console.error(error);
        return throwError(() => error);
      })
    );
    }

}

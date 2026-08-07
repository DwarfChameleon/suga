import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, Observable, throwError } from 'rxjs';
import { Order } from '../interface/order';
import { TokenStorageService } from './token-storage.service';
import { environment } from 'src/environments/environment';
@Injectable({
  providedIn: 'root',
})
export class ChefDashboardService {
  private baseUrl = `${environment.apiUrl}`;

  constructor(private http: HttpClient,private tokenStorageService:TokenStorageService) {}

private getToken(): string {
  // Implement logic to retrieve the token from storage or authentication service
  return localStorage.getItem('authToken') || '';
}

  private getAuthHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${this.tokenStorageService.getAccessToken()}`,
      'x-refresh-token': `${this.tokenStorageService.getRefreshToken()}`
    });
  }
  getChefOrders(): Observable<Order[]> {
    const headers = this.getAuthHeaders();
    return this.http.get<Order[]>(`${this.baseUrl}/chefOrders`, { headers });
  }

  getChefVideos(userId: string): Observable<any[]> {
    const headers = this.getAuthHeaders();
    return this.http.get<any[]>(`${this.baseUrl}/videos/by-user/${userId}`, { headers });
  }

  updateVideoDescription(videoId: string, description: string): Observable<any> {
    const headers = this.getAuthHeaders().set('Content-Type', 'application/json');
    return this.http.put<any>(`${this.baseUrl}/videos/${videoId}`, { description }, { headers });
  }

  updateVideoSettings(videoId: string, payload: {
    description?: string;
    visibility?: 'public' | 'followers' | 'private';
    orderEnabled?: boolean;
    linkedFoodId?: string;
  }): Observable<any> {
    const headers = this.getAuthHeaders().set('Content-Type', 'application/json');
    return this.http.put<any>(`${this.baseUrl}/videos/${videoId}`, payload, { headers });
  }

  deleteVideo(videoId: string): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.delete<any>(`${this.baseUrl}/videos/${videoId}`, { headers });
  }

  saveVideo(videoId: string): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.post<any>(`${this.baseUrl}/videos/${videoId}/save`, {}, { headers });
  }

  getChefFollowers(chefId: string): Observable<any[]> {
    const headers = this.getAuthHeaders();
    return this.http.get<any[]>(`${this.baseUrl}/user/chef-followers/${chefId}`, { headers });
  }
  

updateOrderStatus(
  orderId: string,
  status: string,
  options?: { dispatchRiderId?: string; autoAssign?: boolean; dispatchAssign?: boolean }
): Observable<Order> {
  const headers = this.getAuthHeaders().set('Content-Type', 'application/json');

  return this.http.put<Order>(
    `${this.baseUrl}/order/${orderId}/status`,
    {
      status,
      dispatchRiderId: options?.dispatchRiderId,
      autoAssign: options?.autoAssign,
      dispatchAssign: options?.dispatchAssign
    },
    { headers }
  )
    .pipe(
      catchError((error) => {
        console.error('Error updating order status:', error);
        return throwError(error);
      })
    );
}


  
  

}

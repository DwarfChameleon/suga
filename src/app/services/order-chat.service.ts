import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface OrderChatMessage {
  _id?: string;
  senderId: string;
  senderRole: 'consumer' | 'chef' | 'dispatch';
  username: string;
  message: string;
  createdAt: string | Date;
}

export interface OrderChatResponse {
  orderId: string;
  available: boolean;
  locked: boolean;
  lockedAt?: string | Date | null;
  messages: OrderChatMessage[];
}

@Injectable({
  providedIn: 'root'
})
export class OrderChatService {
  private readonly baseUrl = `${environment.apiUrl}/order`;

  constructor(private http: HttpClient) {}

  getChat(orderId: string): Observable<OrderChatResponse> {
    return this.http.get<OrderChatResponse>(`${this.baseUrl}/${orderId}/chat`);
  }

  sendMessage(orderId: string, message: string): Observable<{ message: OrderChatMessage; locked: boolean }> {
    return this.http.post<{ message: OrderChatMessage; locked: boolean }>(
      `${this.baseUrl}/${orderId}/chat`,
      { message }
    );
  }
}

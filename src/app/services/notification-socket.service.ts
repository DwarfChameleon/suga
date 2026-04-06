import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from 'src/environments/environment';
import { Subject } from 'rxjs';
import { AppNotification } from '../interface/notification';

@Injectable({
  providedIn: 'root'
})
export class NotificationSocketService {
  private socket: Socket | null = null;
  private notificationSubject = new Subject<AppNotification>();
  private token: string | null = null;

  notifications$ = this.notificationSubject.asObservable();

  connect(token: string): void {
    this.token = token;
    if (this.socket) {
      this.socket.auth = { token };
      if (!this.socket.connected) {
        this.socket.connect();
      }
      return;
    }

    this.socket = io(environment.socketUrl, {
      transports: ['websocket'],
      auth: { token }
    });

    this.socket.on('notification:created', (payload: AppNotification) => {
      this.notificationSubject.next(payload);
    });

    this.socket.on('connect_error', () => {
      // Keep trying; socket.io will auto-reconnect
    });

    this.socket.on('reconnect_attempt', () => {
      if (this.token) {
        this.socket!.auth = { token: this.token };
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

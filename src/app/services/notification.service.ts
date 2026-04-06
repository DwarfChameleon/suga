import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { AppNotification } from '../interface/notification';
import { environment } from 'src/environments/environment';
import { UiFeedbackService } from './ui-feedback.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notifications$ = new BehaviorSubject<AppNotification[]>([]);
  private unreadCount$ = new BehaviorSubject<number>(0);
  private cacheKey = 'notifications-cache';

  constructor(private http: HttpClient, private uiFeedback: UiFeedbackService) {}

  getNotifications(): Observable<AppNotification[]> {
    return this.notifications$.asObservable();
  }

  getUnreadCount(): Observable<number> {
    return this.unreadCount$.asObservable();
  }

  loadInitial(): void {
    const cached = this.loadCache();
    if (cached.length) {
      this.notifications$.next(cached);
      this.unreadCount$.next(cached.filter(n => !n.read).length);
    }

    this.http.get<AppNotification[]>(`${environment.apiUrl}/notifications?limit=50`)
      .subscribe({
        next: (items) => {
          this.notifications$.next(items);
          this.unreadCount$.next(items.filter(n => !n.read).length);
          this.saveCache(items);
        },
        error: () => {
          this.uiFeedback.error('Unable to load notifications. Check your connection.');
        }
      });
  }

  addNotification(notification: AppNotification): void {
    const current = this.notifications$.getValue();
    const next = [notification, ...current];
    this.notifications$.next(next);
    this.unreadCount$.next(next.filter(n => !n.read).length);
    this.saveCache(next);
  }

  markRead(ids: string[]): Observable<any> {
    return this.http.post(`${environment.apiUrl}/notifications/mark-read`, { ids });
  }

  markAllRead(): Observable<any> {
    return this.http.post(`${environment.apiUrl}/notifications/mark-all-read`, {});
  }

  updateReadState(ids: string[]): void {
    const current = this.notifications$.getValue();
    const next = current.map(n => ids.includes(n._id) ? { ...n, read: true } : n);
    this.notifications$.next(next);
    this.unreadCount$.next(next.filter(n => !n.read).length);
    this.saveCache(next);
  }

  updateAllReadState(): void {
    const current = this.notifications$.getValue();
    const next = current.map(n => ({ ...n, read: true }));
    this.notifications$.next(next);
    this.unreadCount$.next(0);
    this.saveCache(next);
  }

  clear(): void {
    this.notifications$.next([]);
    this.unreadCount$.next(0);
    localStorage.removeItem(this.cacheKey);
  }

  private saveCache(items: AppNotification[]): void {
    localStorage.setItem(this.cacheKey, JSON.stringify(items.slice(0, 100)));
  }

  private loadCache(): AppNotification[] {
    try {
      const raw = localStorage.getItem(this.cacheKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}

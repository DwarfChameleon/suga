import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { FoodCategory } from './food.service';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly adminApi = `${environment.apiUrl}/admin`;

  constructor(private readonly http: HttpClient) {}

  getCategories(): Observable<{ categories: FoodCategory[] }> {
    return this.http.get<{ categories: FoodCategory[] }>(`${this.adminApi}/categories`);
  }

  createCategory(name: string, images: File[] = []): Observable<{ message: string; category: FoodCategory }> {
    const form = new FormData();
    form.append('name', name);
    images.slice(0, 4).forEach((image) => form.append('images', image));
    return this.http.post<{ message: string; category: FoodCategory }>(`${this.adminApi}/categories`, form);
  }

  getAdmins(): Observable<{ admins: Array<{ _id: string; username: string; email: string; adminAccessLevel: 'super' | 'manager' | 'support'; createdAt: string; isBanned?: boolean; authLocked?: boolean }> }> {
    return this.http.get<{ admins: Array<{ _id: string; username: string; email: string; adminAccessLevel: 'super' | 'manager' | 'support'; createdAt: string; isBanned?: boolean; authLocked?: boolean }> }>(`${this.adminApi}/admins`);
  }

  createAdmin(payload: { username: string; email: string; password: string; adminAccessLevel: 'super' | 'manager' | 'support' }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.adminApi}/admins`, payload);
  }

  updateAdminAccessLevel(userId: string, adminAccessLevel: 'super' | 'manager' | 'support'): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.adminApi}/admins/${userId}/access-level`, { adminAccessLevel });
  }

  getUsers(page = 1, limit = 30): Observable<{ users: Array<{ _id: string; username?: string; name?: string; email: string; roles: string[]; chefLevel?: string; consumerLevel?: string }>; total: number }> {
    return this.http.get<{ users: Array<{ _id: string; username?: string; name?: string; email: string; roles: string[]; chefLevel?: string; consumerLevel?: string }>; total: number }>(
      `${this.adminApi}/users?page=${page}&limit=${limit}`
    );
  }

  setUserLevel(userId: string, payload: { levelType: 'consumer' | 'chef'; level: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.adminApi}/users/${userId}/level`, payload);
  }

  getFoods(page = 1, limit = 20): Observable<{ foods: Array<{ _id: string; dishName: string; price: number; availability?: boolean; chef?: string; createdAt?: string }>; total: number }> {
    return this.http.get<{ foods: Array<{ _id: string; dishName: string; price: number; availability?: boolean; chef?: string; createdAt?: string }>; total: number }>(
      `${this.adminApi}/foods?page=${page}&limit=${limit}`
    );
  }
}

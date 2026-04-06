import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Food } from '../interface/food';
import { environment } from 'src/environments/environment';

export interface FoodCategory {
  name: string;
  image?: string;
  images?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class FoodService {
  private apiUrl = `${environment.apiUrl}/food`;

  constructor(private http: HttpClient) {}

  registerFood(formData: FormData): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}`, formData);
  }

  getAllFoods(): Observable<Food[]> {
    return this.http.get<Food[]>(`${this.apiUrl}/all`);
  }

  getFollowedFoods(): Observable<Food[]> {
    return this.http.get<Food[]>(`${this.apiUrl}/all/followed`);
  }

  getFoodsByChef(username: string): Observable<Food[]> {
    return this.http.get<Food[]>(`${this.apiUrl}/byChef?username=${username}`);
  }

  getFoodsWithChefNames(chefName: string): Observable<Food[]> {
    const params = new HttpParams().set('chefName', chefName);
    return this.http.get<Food[]>(`${this.apiUrl}/foods-with-chef-names`, { params });
  }

  getFoodsByChefUsername(username: string): Observable<Food[]> {
    const params = new HttpParams().set('username', username);
    return this.http.get<Food[]>(`${this.apiUrl}/byChef`, { params });
  }
  getFoodById(foodId: string): Observable<Food> {
    return this.http.get<Food>(`${this.apiUrl}/${foodId}`);
  }

  getFoodsByCategory(category: string, region?: { country?: string; state?: string }): Observable<Food[]> {
    let params = new HttpParams();
    if (region?.country) params = params.set('country', region.country);
    if (region?.state) params = params.set('state', region.state);
    return this.http.get<Food[]>(`${this.apiUrl}/category/${encodeURIComponent(category)}`, { params });
  }

  getCategoryList(): Observable<FoodCategory[]> {
    return this.http.get<FoodCategory[]>(`${this.apiUrl}/categories/list`);
  }

  getFoodRecommendations(foodId: string, limit = 8): Observable<{
    source: { foodId: string; category: string; country: string; state: string };
    sameChef: Food[];
    sameCategoryRegion: Food[];
  }> {
    const params = new HttpParams().set('limit', String(limit));
    return this.http.get<{
      source: { foodId: string; category: string; country: string; state: string };
      sameChef: Food[];
      sameCategoryRegion: Food[];
    }>(`${this.apiUrl}/${foodId}/recommendations`, { params });
  }

  likeFood(foodId: string): Observable<{ likes: number; liked: boolean }> {
    return this.http.post<{ likes: number; liked: boolean }>(`${this.apiUrl}/${foodId}/like`, {});
  }

  addComment(foodId: string, text: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${foodId}/comment`, { text });
  }
}

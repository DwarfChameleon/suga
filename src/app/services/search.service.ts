import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface SearchResults {
  foods: any[];
  videos: any[];
  users: any[];
}

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private baseUrl = `${environment.apiUrl}/search`;

  constructor(private http: HttpClient) {}

  search(query: string): Observable<SearchResults> {
    return this.http.get<SearchResults>(`${this.baseUrl}?q=${encodeURIComponent(query)}`);
  }
}

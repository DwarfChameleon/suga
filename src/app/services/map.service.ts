import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private readonly baseUrl = `${environment.apiUrl}/routes`;

  constructor(private readonly http: HttpClient) {}

  getRoute(coords: Array<[number, number]>): Observable<{ geometry: { type: string; coordinates: number[][] } }> {
    return this.http.post<{ geometry: { type: string; coordinates: number[][] } }>(
      `${this.baseUrl}/route`,
      { coords }
    );
  }

  geocode(query: string): Observable<{ results: Array<{ displayName: string; lat: number; lng: number; address: any }> }> {
    return this.http.post<{ results: Array<{ displayName: string; lat: number; lng: number; address: any }> }>(
      `${this.baseUrl}/geocode`,
      { query }
    );
  }
}

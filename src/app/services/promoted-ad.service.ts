import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface PromotedAd {
  _id: string;
  sponsorName: string;
  title: string;
  body: string;
  imageUrl: string;
  targetUrl: string;
  placement: string;
  priority: number;
  active: boolean;
  audience: 'all' | 'consumer' | 'chef' | 'dispatch';
}

@Injectable({
  providedIn: 'root'
})
export class PromotedAdService {
  constructor(private readonly http: HttpClient) {}

  getPlacementAd(placement: string): Observable<PromotedAd | null> {
    return this.http
      .get<{ ok: boolean; ad?: PromotedAd | null }>(`${environment.apiUrl}/ads/slot/${placement}`)
      .pipe(
        map((response) => response?.ad || null),
        catchError(() => of(null))
      );
  }
}

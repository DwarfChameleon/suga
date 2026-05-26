import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { CurrencyFormatService } from './currency-format.service';
import { environment } from 'src/environments/environment';

export interface CurrencyConversion {
  amount: number;
  convertedAmount: number;
  from: string;
  to: string;
  rate: number;
  source: string;
  provider?: string;
  providerUpdatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CurrencyConversionService {
  private readonly cache = new Map<string, CurrencyConversion>();
  private readonly pending = new Set<string>();

  constructor(
    private readonly http: HttpClient,
    private readonly currencyFormat: CurrencyFormatService
  ) {}

  formatConverted(amount: number | string | null | undefined, from?: string, digits = '1.0-0', to = this.currencyFormat.getUserCurrency()): string {
    const sourceCurrency = this.normalize(from || to);
    const targetCurrency = this.normalize(to);
    if (sourceCurrency === targetCurrency) {
      return this.currencyFormat.format(amount, targetCurrency, digits);
    }

    const key = this.key(amount, sourceCurrency, targetCurrency);
    const cached = this.cache.get(key);
    if (cached) {
      return this.currencyFormat.format(cached.convertedAmount, cached.to, digits);
    }

    this.convert(amount, sourceCurrency, targetCurrency);
    return `${this.currencyFormat.format(amount, sourceCurrency, digits)} -> ${targetCurrency}`;
  }

  private convert(amount: number | string | null | undefined, from: string, to: string): void {
    const key = this.key(amount, from, to);
    if (this.cache.has(key) || this.pending.has(key)) return;
    this.pending.add(key);

    const params = new HttpParams()
      .set('amount', String(Number(amount || 0)))
      .set('from', from)
      .set('to', to);

    this.http.get<CurrencyConversion>(`${environment.apiUrl}/currency/convert`, { params }).subscribe({
      next: (result) => {
        this.cache.set(key, result);
        this.pending.delete(key);
      },
      error: () => {
        this.pending.delete(key);
      }
    });
  }

  private key(amount: number | string | null | undefined, from: string, to: string): string {
    return `${Number(amount || 0)}:${this.normalize(from)}:${this.normalize(to)}`;
  }

  private normalize(value?: string): string {
    return String(value || 'NGN').trim().toUpperCase();
  }
}

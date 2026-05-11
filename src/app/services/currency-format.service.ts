import { Injectable } from '@angular/core';
import { TokenStorageService } from './token-storage.service';

@Injectable({
  providedIn: 'root'
})
export class CurrencyFormatService {
  private readonly countryCurrency: Record<string, string> = {
    Nigeria: 'NGN',
    'United States': 'USD',
    'United Kingdom': 'GBP',
    Ghana: 'GHS',
    'South Africa': 'ZAR',
    Kenya: 'KES',
    France: 'EUR',
    Italy: 'EUR'
  };

  constructor(private readonly tokenStorage: TokenStorageService) {}

  getCurrencyForCountry(country?: string): string {
    return this.countryCurrency[String(country || '').trim()] || this.getUserCurrency();
  }

  getUserCurrency(): string {
    const user = this.tokenStorage.getUser();
    return String(user?.preferredCurrency || this.countryCurrency[user?.country] || 'NGN').toUpperCase();
  }

  format(amount: number | string | null | undefined, currency = this.getUserCurrency(), digits = '1.0-0'): string {
    const numericAmount = Number(amount || 0);
    const [minimumFractionDigits, maximumFractionDigits] = this.parseDigits(digits);
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: String(currency || 'NGN').toUpperCase(),
        currencyDisplay: 'symbol',
        minimumFractionDigits,
        maximumFractionDigits
      }).format(numericAmount);
    } catch {
      return `${String(currency || 'NGN').toUpperCase()} ${numericAmount.toLocaleString()}`;
    }
  }

  private parseDigits(digits: string): [number, number] {
    const match = String(digits || '').match(/\.(\d+)-(\d+)$/);
    if (!match) return [0, 0];
    return [Number(match[1]), Number(match[2])];
  }
}

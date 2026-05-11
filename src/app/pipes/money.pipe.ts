import { Pipe, PipeTransform } from '@angular/core';
import { CurrencyFormatService } from '../services/currency-format.service';

@Pipe({
  name: 'money',
  pure: false
})
export class MoneyPipe implements PipeTransform {
  constructor(private readonly currencyFormat: CurrencyFormatService) {}

  transform(value: number | string | null | undefined, currency?: string, digits = '1.0-0'): string {
    return this.currencyFormat.format(value, currency || this.currencyFormat.getUserCurrency(), digits);
  }
}

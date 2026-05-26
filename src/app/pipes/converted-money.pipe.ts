import { ChangeDetectorRef, Pipe, PipeTransform } from '@angular/core';
import { CurrencyConversionService } from '../services/currency-conversion.service';

@Pipe({
  name: 'convertedMoney',
  pure: false
})
export class ConvertedMoneyPipe implements PipeTransform {
  constructor(
    private readonly conversion: CurrencyConversionService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  transform(value: number | string | null | undefined, sourceCurrency?: string, digits = '1.0-0', targetCurrency?: string): string {
    const rendered = this.conversion.formatConverted(value, sourceCurrency, digits, targetCurrency);
    if (rendered.includes(' -> ')) {
      window.setTimeout(() => this.cdr.markForCheck(), 900);
    }
    return rendered;
  }
}

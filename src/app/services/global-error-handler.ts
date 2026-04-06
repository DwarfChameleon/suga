import { ErrorHandler, Injectable } from '@angular/core';
import { AppLogService } from './app-log.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private appLog: AppLogService) {}

  handleError(error: any): void {
    const message = error?.message || error?.toString?.() || 'Unknown error';
    const stack = error?.stack || '';
    this.appLog.error(message, { source: 'angular' }, stack);
    // Keep default behavior
    console.error(error);
  }
}

import { Injectable } from '@angular/core';

export type AppLogLevel = 'info' | 'warn' | 'error';

export interface AppLogEntry {
  id: string;
  level: AppLogLevel;
  message: string;
  stack?: string;
  context?: any;
  url?: string;
  createdAt: string;
}

const STORAGE_KEY = 'suga_app_logs_v1';
const MAX_LOGS = 200;

@Injectable({ providedIn: 'root' })
export class AppLogService {
  private cache: AppLogEntry[] = [];

  constructor() {
    this.load();
    this.attachGlobalHandlers();
  }

  log(level: AppLogLevel, message: string, context?: any, stack?: string): void {
    const entry: AppLogEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      level,
      message: String(message || ''),
      stack,
      context,
      url: typeof window !== 'undefined' ? window.location?.href : '',
      createdAt: new Date().toISOString()
    };
    this.cache.unshift(entry);
    if (this.cache.length > MAX_LOGS) this.cache = this.cache.slice(0, MAX_LOGS);
    this.persist();
  }

  info(message: string, context?: any): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: any): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: any, stack?: string): void {
    this.log('error', message, context, stack);
  }

  getAll(): AppLogEntry[] {
    return [...this.cache];
  }

  clear(): void {
    this.cache = [];
    this.persist();
  }

  exportJson(): string {
    return JSON.stringify(this.cache, null, 2);
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.cache = raw ? JSON.parse(raw) : [];
    } catch {
      this.cache = [];
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache));
    } catch {
      // ignore storage errors
    }
  }

  private attachGlobalHandlers(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('error', (event) => {
      const message = event?.message || 'Unhandled error';
      const stack = event?.error?.stack || '';
      this.error(message, { filename: event?.filename, lineno: event?.lineno, colno: event?.colno }, stack);
    });
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      const reason = (event?.reason && event.reason.message) ? event.reason.message : String(event?.reason || 'Unhandled rejection');
      const stack = event?.reason?.stack || '';
      this.error(reason, { type: 'unhandledrejection' }, stack);
    });
  }
}

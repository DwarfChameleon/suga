import { Injectable } from '@angular/core';

export type AppTheme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly storageKey = 'suga-ui-theme';

  apply(theme: AppTheme): void {
    document.body.classList.remove('suga-light-theme', 'suga-dark-theme');
    document.body.classList.add(theme === 'dark' ? 'suga-dark-theme' : 'suga-light-theme');
    localStorage.setItem(this.storageKey, theme);
  }

  getSavedTheme(): AppTheme {
    const saved = localStorage.getItem(this.storageKey);
    return saved === 'dark' ? 'dark' : 'light';
  }
}

import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

export type AppTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'bugconnect-theme';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  readonly currentTheme = signal<AppTheme>('light');
  readonly isDark = computed(() => this.currentTheme() === 'dark');

  constructor() {
    this.setTheme(this.readSavedTheme(), false);
  }

  toggleTheme(): void {
    this.setTheme(this.isDark() ? 'light' : 'dark');
  }

  setTheme(theme: AppTheme, persist = true): void {
    this.currentTheme.set(theme);
    this.document.documentElement.setAttribute('data-theme', theme);

    if (persist && isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        // The selected theme still works for this page if storage is unavailable.
      }
    }
  }

  private readSavedTheme(): AppTheme {
    if (!isPlatformBrowser(this.platformId)) {
      return 'light';
    }

    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }
}

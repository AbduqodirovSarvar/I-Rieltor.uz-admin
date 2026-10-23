import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { DARK_MODE_CLASS } from '../theme/app-theme';

const STORAGE_KEY = 'irieltor.admin.theme';

/** Light / dark. The choice is remembered; the first time it follows the system setting. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly isDark = signal(this.initial());

  readonly dark = this.isDark.asReadonly();

  constructor() {
    this.apply(this.isDark());
  }

  toggle(): void {
    const next = !this.isDark();
    this.isDark.set(next);
    this.apply(next);
    try {
      this.document.defaultView?.localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
    } catch {
      // Not remembered; fine.
    }
  }

  private initial(): boolean {
    const view = this.document.defaultView;
    try {
      const saved = view?.localStorage.getItem(STORAGE_KEY);
      if (saved) return saved === 'dark';
    } catch {
      // Storage blocked: follow the system.
    }
    return view?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }

  private apply(dark: boolean): void {
    this.document.documentElement.classList.toggle(DARK_MODE_CLASS, dark);
  }
}

import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { Session } from './session';

const STORAGE_KEY = 'irieltor.admin.session';

/**
 * The session in `localStorage`, so every tab of the panel sees the same tokens (the backend rotates the refresh token on
 * each use, so two tabs holding different copies would end each other's session). The `session` signal follows changes
 * made by other tabs through the `storage` event.
 */
@Injectable({ providedIn: 'root' })
export class TokenStore {
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly state = signal<Session | null>(this.read());

  readonly session = this.state.asReadonly();

  constructor() {
    this.window?.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY || event.key === null) this.state.set(this.read());
    });
  }

  get accessToken(): string | null {
    return this.state()?.accessToken ?? null;
  }

  set(session: Session): void {
    try {
      this.window?.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Storage blocked or full: the session then lives until the page is closed.
    }
    this.state.set(session);
  }

  clear(): void {
    try {
      this.window?.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to remove.
    }
    this.state.set(null);
  }

  /** Re-reads the storage (another tab may have refreshed the tokens meanwhile). */
  reload(): Session | null {
    const session = this.read();
    this.state.set(session);
    return session;
  }

  private read(): Session | null {
    try {
      const raw = this.window?.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const value = JSON.parse(raw) as Partial<Session>;
      return value.accessToken && value.refreshToken ? (value as Session) : null;
    } catch {
      return null;
    }
  }
}

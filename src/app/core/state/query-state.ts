import { Injectable, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

/**
 * Keeps the state of a list page (page, search, sort, filters) in the address, so a refresh, the back button and a pasted
 * link show the same list. Several parts of a page (table, filter bar) change it in the same moment; their changes are
 * collected and applied as ONE navigation, otherwise the second would cancel the first.
 */
@Injectable({ providedIn: 'root' })
export class QueryState {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private pending: Record<string, string | null> | null = null;

  /** The current value of an address parameter. */
  get(name: string): string | null {
    const pending = this.pending?.[name];
    if (pending !== undefined) return pending;
    return this.router.parseUrl(this.router.url).queryParams[name] ?? null;
  }

  /** Sets parameters (`null` removes one). */
  patch(values: Record<string, string | number | null | undefined>): void {
    const normalized = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        value === undefined || value === null || value === '' ? null : String(value),
      ]),
    );
    if (this.pending) {
      Object.assign(this.pending, normalized);
      return;
    }
    this.pending = { ...normalized };
    queueMicrotask(() => {
      const queryParams = this.pending ?? {};
      this.pending = null;
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams,
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  }
}

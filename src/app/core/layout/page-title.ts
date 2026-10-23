import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { I18n, TextKey } from '../i18n/i18n.service';

/** Route data key holding the text key of the page title: `data: { title: 'nav.users' }`. */
export const TITLE_DATA = 'title';

/** The titles of the current route chain, outermost first (used for the breadcrumb). */
export function routeTitles(snapshot: RouterStateSnapshot | ActivatedRouteSnapshot): TextKey[] {
  const titles: TextKey[] = [];
  let node: ActivatedRouteSnapshot | null = 'root' in snapshot ? snapshot.root : snapshot;
  while (node) {
    const title = node.data[TITLE_DATA] as TextKey | undefined;
    if (title) titles.push(title);
    node = node.firstChild;
  }
  return titles;
}

/** Sets the browser tab title from the route's `title` data. */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly i18n = inject(I18n);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const titles = routeTitles(snapshot);
    const last = titles[titles.length - 1];
    const app = this.i18n.t('app.name');
    this.title.setTitle(last ? `${this.i18n.t(last)} | ${app}` : app);
  }
}

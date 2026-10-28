import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { PermissionService } from '../../core/auth/permission.service';
import { I18n } from '../../core/i18n/i18n.service';
import { LanguageSwitch } from '../../core/i18n/language-switch';
import { TPipe } from '../../core/i18n/t.pipe';
import { NAV } from '../../core/layout/nav';
import { routeTitles } from '../../core/layout/page-title';
import { ThemeService } from '../../core/layout/theme.service';

/** The frame of every page: side menu (by permission), top bar, breadcrumb, user menu. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonModule, LanguageSwitch, TPipe],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly router = inject(Router);
  private readonly permissions = inject(PermissionService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18n);
  protected readonly theme = inject(ThemeService);

  protected readonly menuOpen = signal(false);
  protected readonly userName = this.auth.displayName;
  protected readonly role = this.permissions.role;
  protected readonly initials = computed(() =>
    this.userName()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join(''),
  );

  /** Only the groups and items the user may see and that already exist. */
  protected readonly groups = computed(() =>
    NAV.map((group) => ({
      label: group.label,
      items: group.items.filter((item) => item.ready && this.permissions.hasAny(item.permissions)),
    })).filter((group) => group.items.length > 0),
  );

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Breadcrumb: the titles of the route chain. */
  protected readonly crumbs = computed(() => {
    this.url();
    return routeTitles(this.router.routerState.snapshot)
      .filter((key) => key !== 'nav.dashboard')
      .map((key) => this.i18n.t(key));
  });

  constructor() {
    if (!this.auth.currentUser()) this.auth.loadProfile().subscribe();
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected signOut(): void {
    this.auth.signOut().subscribe(() => void this.router.navigate(['/login']));
  }
}

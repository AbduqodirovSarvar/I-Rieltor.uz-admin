import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { interval } from 'rxjs';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PermissionService } from '../../core/auth/permission.service';
import { DateTimePipe, MoneyPipe, formatMoney, formatNumber } from '../../core/format/format';
import { I18n } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { formatDateTime } from '../../core/time/tashkent';
import { BarChart, BarPoint } from '../../shared/ui/charts/bar-chart';
import { EmptyState } from '../../shared/ui/misc/empty-state';
import { PageHeader } from '../../shared/ui/misc/page-header';
import { StatCard } from '../../shared/ui/misc/stat-card';
import { StatusBadge } from '../../shared/ui/misc/status-badge';
import { DashboardService, DashboardSummary } from './dashboard.service';

const REFRESH_MS = 30_000;

/** The home page: totals, the last 30 days and the auctions that need attention. */
@Component({
  selector: 'app-dashboard-page',
  imports: [
    RouterLink,
    ButtonModule,
    BarChart,
    EmptyState,
    PageHeader,
    StatCard,
    StatusBadge,
    MoneyPipe,
    DateTimePipe,
    TPipe,
  ],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage implements OnInit {
  private readonly service = inject(DashboardService);
  private readonly i18n = inject(I18n);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly canSee = inject(PermissionService).has('READ_DASHBOARD');

  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);

  protected readonly updated = computed(() => {
    const at = this.summary()?.generatedAt;
    return at ? this.i18n.t('dashboard.updated', { time: formatDateTime(at) }) : null;
  });

  protected readonly userChart = computed<BarPoint[]>(() => this.series((d) => d.newUsers));
  protected readonly bidChart = computed<BarPoint[]>(() => this.series((d) => d.bids));
  protected readonly moneyChart = computed<BarPoint[]>(() => this.series((d) => d.paidAmount));

  protected readonly formatCount = (value: number) => formatNumber(value);
  protected readonly formatSum = (value: number) => formatMoney(value);

  protected readonly userTypes = computed(() =>
    Object.entries(this.summary()?.users.byType ?? {})
      .map(([type, count]) => `${this.i18n.enumLabel('ClientType', type)}: ${count}`)
      .join(' · '),
  );

  protected newUsers(count: number): string {
    return this.i18n.t('dashboard.newUsers', { count });
  }

  protected amount(value: number): string {
    return formatMoney(value);
  }

  protected tr(key: 'dashboard.refundsAmount' | 'dashboard.revenue', amount: number): string {
    return this.i18n.t(key, { amount: formatMoney(amount) });
  }

  ngOnInit(): void {
    if (!this.canSee) return;
    this.load();
    // Numbers older than the backend's cache are pointless to fetch while the tab is hidden.
    interval(REFRESH_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.document.hidden) this.load(true);
      });
  }

  protected load(quiet = false): void {
    if (this.loading()) return;
    this.loading.set(!quiet);
    this.service.summary().subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.failed.set(false);
        this.loading.set(false);
      },
      error: () => {
        // A failed background refresh keeps the numbers on screen; only a first load shows the failure.
        if (!this.summary()) this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  private series(
    pick: (day: { newUsers: number; bids: number; paidAmount: number }) => number,
  ): BarPoint[] {
    return (this.summary()?.last30Days ?? []).map((day) => ({
      label: `${day.date.slice(8, 10)}.${day.date.slice(5, 7)}`,
      value: pick(day),
    }));
  }
}

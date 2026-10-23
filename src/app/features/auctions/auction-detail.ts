import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { auditTime, interval } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TabsModule } from 'primeng/tabs';
import { TextareaModule } from 'primeng/textarea';
import { HasPermissionDirective } from '../../core/auth/has-permission.directive';
import { DateTimePipe, MoneyPipe, PhonePipe } from '../../core/format/format';
import { ListQuery } from '../../core/http/response-model';
import { I18n, TextKey } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { Notify } from '../../core/notify/notify.service';
import { AuctionLive, BidPlacedEvent } from '../../core/realtime/auction-live';
import { QueryState } from '../../core/state/query-state';
import { DataTable, RowActionsTemplate, TableColumn } from '../../shared/ui/data-table/data-table';
import { KeyValue } from '../../shared/ui/misc/key-value';
import { PageHeader } from '../../shared/ui/misc/page-header';
import { StatusBadge } from '../../shared/ui/misc/status-badge';
import { ParticipantActions } from '../participants/participant-actions';
import { Participant, ParticipantService } from '../participants/participant.service';
import { Payment, PaymentService } from '../payments/payment.service';
import { Auction, AuctionService, PublicBid } from './auction.service';

@Component({
  selector: 'app-auction-detail',
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    DialogModule,
    TabsModule,
    TextareaModule,
    DataTable,
    RowActionsTemplate,
    KeyValue,
    PageHeader,
    StatusBadge,
    ParticipantActions,
    HasPermissionDirective,
    MoneyPipe,
    DateTimePipe,
    PhonePipe,
    TPipe,
  ],
  templateUrl: './auction-detail.html',
  styleUrl: './auction-detail.scss',
  providers: [AuctionLive],
})
export class AuctionDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auctions = inject(AuctionService);
  private readonly participants = inject(ParticipantService);
  private readonly payments = inject(PaymentService);
  private readonly notify = inject(Notify);
  private readonly i18n = inject(I18n);
  private readonly query = inject(QueryState);
  protected readonly live = inject(AuctionLive);

  protected readonly id = this.route.snapshot.paramMap.get('id') as string;
  protected readonly auction = signal<Auction | null>(null);
  protected readonly loading = signal(true);
  protected readonly tab = signal('overview');
  protected readonly reload = signal(0);

  protected readonly help = computed(() => {
    const status = this.auction()?.status;
    return status ? this.i18n.t(`auctions.help.${status}` as TextKey) : '';
  });

  // Cancel dialog
  protected readonly cancelDialog = signal(false);
  protected cancelReason = '';
  protected readonly cancelling = signal(false);
  protected readonly publishing = signal(false);

  // Tables
  protected readonly bidColumns: TableColumn<PublicBid>[] = [
    { field: 'participantNumber', header: this.i18n.t('auctions.bidNumber'), sortField: false },
    {
      field: 'amount',
      header: this.i18n.t('auctions.bidAmount'),
      type: 'money',
      align: 'right',
      sortField: false,
    },
    {
      field: 'placedAt',
      header: this.i18n.t('auctions.bidTime'),
      type: 'datetime',
      sortField: false,
    },
  ];
  protected readonly participantColumns: TableColumn<Participant>[] = [
    { field: 'participantNumber', header: this.i18n.t('auctions.bidNumber') },
    { field: 'userFullName', header: this.i18n.t('auctions.person'), sortField: false },
    { field: 'userIdentifier', header: this.i18n.t('users.innpinfl'), sortField: false },
    { field: 'userPhone', header: this.i18n.t('users.phone'), type: 'phone', sortField: false },
    {
      field: 'status',
      header: this.i18n.t('auctions.participantStatus'),
      type: 'enum',
      enumName: 'ParticipantStatus',
    },
    {
      field: 'depositStatus',
      header: this.i18n.t('auctions.deposit'),
      type: 'enum',
      enumName: 'DepositStatus',
    },
  ];
  protected readonly paymentColumns: TableColumn<Payment>[] = [
    { field: 'userFullName', header: this.i18n.t('auctions.payer'), sortField: false },
    {
      field: 'purpose',
      header: this.i18n.t('auctions.purpose'),
      type: 'enum',
      enumName: 'PaymentPurpose',
    },
    { field: 'amount', header: this.i18n.t('auctions.amount'), type: 'money', align: 'right' },
    {
      field: 'provider',
      header: this.i18n.t('auctions.provider'),
      type: 'enum',
      enumName: 'PaymentProvider',
    },
    {
      field: 'status',
      header: this.i18n.t('auctions.status'),
      type: 'enum',
      enumName: 'PaymentStatus',
    },
    { field: 'paidAt', header: this.i18n.t('auctions.paidAt'), type: 'datetime' },
  ];

  protected readonly fetchBids = (query: ListQuery) => this.auctions.bids(this.id, query);
  protected readonly fetchParticipants = (query: ListQuery) =>
    this.participants.ofAuction(this.id, query);
  protected readonly fetchPayments = (query: ListQuery) => this.payments.ofAuction(this.id, query);
  protected readonly byNumber = { field: 'ParticipantNumber', direction: 'asc' as const };

  // ---- live
  protected readonly feed = signal<BidPlacedEvent[]>([]);
  private readonly lastMinNext = signal<number | null>(null);
  private readonly now = signal(Date.now());

  protected readonly isActive = computed(() => {
    const status = this.auction()?.status;
    return status === 'SCHEDULED' || status === 'ONGOING';
  });

  /** The smallest bid that will be accepted next (from the last message, else from the price and the step). */
  protected readonly minNext = computed(() => {
    const auction = this.auction();
    if (!auction) return null;
    return (
      this.lastMinNext() ??
      (auction.currentPrice === null
        ? auction.startingPrice
        : auction.currentPrice + auction.minBidStep)
    );
  });

  /** Time to the end of the sale, or to its start while applications are still open. */
  protected readonly countdown = computed(() => {
    const auction = this.auction();
    if (!auction) return '';
    const target = Date.parse(auction.status === 'ONGOING' ? auction.endsAt : auction.startsAt);
    const left = target - this.now();
    return left <= 0 ? this.i18n.t('live.overdue') : formatCountdown(left);
  });
  protected readonly countdownLabel = computed(() =>
    this.i18n.t(this.auction()?.status === 'ONGOING' ? 'live.remainingEnd' : 'live.remainingStart'),
  );
  protected readonly liveLabel = computed(() => this.i18n.t(`live.${this.live.state()}`));

  constructor() {
    interval(1000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.now.set(Date.now()));

    this.live.bids$.pipe(takeUntilDestroyed()).subscribe((event) => {
      this.auction.update((a) =>
        a ? { ...a, currentPrice: event.currentPrice, endsAt: event.endsAt } : a,
      );
      this.lastMinNext.set(event.minNextBid);
      this.feed.update((items) => [event, ...items].slice(0, 10));
    });
    // The bid table is refreshed at most once a second, however fast the bids come.
    this.live.bids$
      .pipe(auditTime(1000), takeUntilDestroyed())
      .subscribe(() => this.reload.update((n) => n + 1));
    this.live.status$.pipe(takeUntilDestroyed()).subscribe(() => this.refresh());
    // After a break the messages that were missed are not replayed: load everything again.
    this.live.resync$.pipe(takeUntilDestroyed()).subscribe(() => this.refresh());
  }

  ngOnInit(): void {
    this.load();
  }

  private refresh(): void {
    this.feed.set([]);
    this.lastMinNext.set(null);
    this.load();
    this.reload.update((n) => n + 1);
  }

  protected load(): void {
    this.auctions.get(this.id).subscribe({
      next: (auction) => {
        this.auction.set(auction);
        this.loading.set(false);
        // Only an auction that is still open has anything to watch.
        if (this.isActive()) {
          if (this.live.state() === 'idle') this.live.watch(this.id);
        } else {
          this.live.stop();
        }
      },
      error: (error: unknown) => {
        this.notify.error(error);
        void this.router.navigate(['/auctions']);
      },
    });
  }

  protected async publish(): Promise<void> {
    if (!(await this.notify.confirm({ message: this.i18n.t('auctions.publishConfirm') }))) return;
    this.publishing.set(true);
    this.auctions.publish(this.id).subscribe({
      next: (auction) => {
        this.publishing.set(false);
        this.auction.set(auction);
        this.notify.success(this.i18n.t('auctions.published'));
      },
      // 400: the start time or the application deadline has passed; 400: the property is not PUBLISHED.
      error: (error: unknown) => {
        this.publishing.set(false);
        this.notify.error(error);
      },
    });
  }

  protected openCancel(): void {
    this.cancelReason = '';
    this.cancelDialog.set(true);
  }

  protected cancel(): void {
    const reason = this.cancelReason.trim();
    if (!reason || this.cancelling()) return;
    this.cancelling.set(true);
    this.auctions.cancel(this.id, reason).subscribe({
      next: (auction) => {
        this.cancelling.set(false);
        this.cancelDialog.set(false);
        this.auction.set(auction);
        this.notify.success(this.i18n.t('auctions.cancelled'));
        this.reload.update((n) => n + 1);
      },
      error: (error: unknown) => {
        this.cancelling.set(false);
        this.notify.error(error);
      },
    });
  }

  protected async remove(): Promise<void> {
    const auction = this.auction();
    if (!auction) return;
    if (
      !(await this.notify.confirmDelete(
        this.i18n.t('auctions.deleteConfirm', { name: auction.lotNumber ?? '' }),
      ))
    )
      return;
    this.auctions.delete(auction.id).subscribe({
      next: () => {
        this.notify.success(this.i18n.t('common.deleted'));
        void this.router.navigate(['/auctions']);
      },
      error: (error: unknown) => this.notify.error(error),
    });
  }

  /** Each tab has its own table; the page, search and sort of the previous one must not carry over. */
  protected selectTab(value: string | number | undefined): void {
    this.query.patch({ page: null, size: null, q: null, sort: null, dir: null });
    this.tab.set(String(value));
  }

  protected reviewed(): void {
    this.reload.update((n) => n + 1);
  }
}

/** `1 kun 02:03:04` / `02:03:04`. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86_400);
  const pad = (n: number) => String(n).padStart(2, '0');
  const clock = `${pad(Math.floor((total % 86_400) / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  return days > 0 ? `${days} kun ${clock}` : clock;
}

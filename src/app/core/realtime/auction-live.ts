import { DOCUMENT } from '@angular/common';
import { Injectable, InjectionToken, OnDestroy, inject, signal } from '@angular/core';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

/** What the hub tells the people who watch an auction (camelCase, as SignalR writes it). */
export interface BidPlacedEvent {
  auctionId: string;
  participantNumber: number;
  amount: number;
  placedAt: string;
  currentPrice: number;
  minNextBid: number;
  endsAt: string;
  extended: boolean;
  bidCount: number;
}

export interface AuctionStatusChangedEvent {
  auctionId: string;
  status: string;
  endsAt: string;
}

export type LiveState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

/** The part of SignalR's connection this app uses (a test supplies a fake). */
export interface HubLike {
  on(method: string, handler: (...args: never[]) => void): void;
  start(): Promise<void>;
  stop(): Promise<void>;
  invoke(method: string, ...args: unknown[]): Promise<unknown>;
  onreconnecting(handler: () => void): void;
  onreconnected(handler: () => void): void;
  onclose(handler: () => void): void;
}

export const HUB_FACTORY = new InjectionToken<() => HubLike>('HUB_FACTORY', {
  providedIn: 'root',
  factory: () => () =>
    new HubConnectionBuilder()
      .withUrl(`${environment.apiUrl}/hubs/auction`)
      // Quick first retries, then calmer ones; the page shows "reconnecting" meanwhile.
      .withAutomaticReconnect([0, 2000, 5000, 10_000, 30_000])
      .configureLogging(LogLevel.Warning)
      .build(),
});

/**
 * Live view of ONE auction for one page: connects, joins the auction's group, and turns the hub's messages into streams.
 * Provide it in the page's `providers` so each page has its own connection that ends with the page. After a break (lost
 * connection, hidden tab) `resync$` fires: the page must reload what it shows, because messages sent meanwhile are not replayed.
 */
@Injectable()
export class AuctionLive implements OnDestroy {
  private readonly factory = inject(HUB_FACTORY);
  private readonly document = inject(DOCUMENT);

  readonly state = signal<LiveState>('idle');
  readonly bids$ = new Subject<BidPlacedEvent>();
  readonly status$ = new Subject<AuctionStatusChangedEvent>();
  readonly resync$ = new Subject<void>();

  private hub: HubLike | null = null;
  private auctionId: string | null = null;
  private wanted = false;
  private readonly onVisibility = () => {
    if (!this.wanted) return;
    if (this.document.hidden) void this.disconnect();
    else void this.connect(true);
  };

  /** Starts watching; a hidden tab pauses the connection and a visible one resumes it. */
  watch(auctionId: string): void {
    this.auctionId = auctionId;
    this.wanted = true;
    this.document.addEventListener('visibilitychange', this.onVisibility);
    if (!this.document.hidden) void this.connect(false);
  }

  stop(): void {
    this.wanted = false;
    this.document.removeEventListener('visibilitychange', this.onVisibility);
    void this.disconnect();
    this.state.set('idle');
  }

  ngOnDestroy(): void {
    this.stop();
    this.bids$.complete();
    this.status$.complete();
    this.resync$.complete();
  }

  private async connect(resync: boolean): Promise<void> {
    if (this.hub || !this.auctionId) return;
    let hub: HubLike;
    try {
      hub = this.factory();
    } catch {
      // The connection could not even be set up (a bad address): the page works without the live view.
      this.state.set('disconnected');
      return;
    }
    this.hub = hub;
    hub.on('BidPlaced', ((event: BidPlacedEvent) => this.bids$.next(event)) as (
      ...args: never[]
    ) => void);
    hub.on('AuctionStatusChanged', ((event: AuctionStatusChangedEvent) =>
      this.status$.next(event)) as (...args: never[]) => void);
    hub.onreconnecting(() => this.state.set('reconnecting'));
    hub.onreconnected(() => {
      void this.join(hub).then(() => {
        this.state.set('connected');
        this.resync$.next();
      });
    });
    hub.onclose(() => {
      if (this.hub === hub) this.state.set('disconnected');
    });

    this.state.set('connecting');
    try {
      await hub.start();
      await this.join(hub);
      this.state.set('connected');
      if (resync) this.resync$.next();
    } catch {
      if (this.hub === hub) {
        this.hub = null;
        this.state.set('disconnected');
      }
    }
  }

  private join(hub: HubLike): Promise<unknown> {
    return hub.invoke('Join', this.auctionId);
  }

  private async disconnect(): Promise<void> {
    const hub = this.hub;
    this.hub = null;
    if (hub) {
      try {
        await hub.stop();
      } catch {
        // Already closed.
      }
    }
  }
}

import { TestBed } from '@angular/core/testing';
import { FakeHub } from '../../testing/fake-hub';
import {
  AuctionLive,
  AuctionStatusChangedEvent,
  BidPlacedEvent,
  HUB_FACTORY,
} from './auction-live';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const bid = (n: number): BidPlacedEvent => ({
  auctionId: 'a1',
  participantNumber: n,
  amount: 100_000_000 + n,
  placedAt: '2026-10-23T09:30:00Z',
  currentPrice: 100_000_000 + n,
  minNextBid: 101_000_000 + n,
  endsAt: '2026-10-23T11:00:00Z',
  extended: false,
  bidCount: n,
});

describe('AuctionLive', () => {
  let hubs: FakeHub[];

  function create(failStart = false) {
    hubs = [];
    TestBed.configureTestingModule({
      providers: [
        AuctionLive,
        {
          provide: HUB_FACTORY,
          useValue: () => {
            const hub = new FakeHub();
            hub.failStart = failStart;
            hubs.push(hub);
            return hub;
          },
        },
      ],
    });
    return TestBed.inject(AuctionLive);
  }

  function setHidden(hidden: boolean) {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  afterEach(() => {
    setHidden(false);
  });

  it('connects, joins the auction group and turns the hub messages into streams', async () => {
    const live = create();
    const bids: BidPlacedEvent[] = [];
    const statuses: AuctionStatusChangedEvent[] = [];
    live.bids$.subscribe((b) => bids.push(b));
    live.status$.subscribe((s) => statuses.push(s));

    expect(live.state()).toBe('idle');
    live.watch('a1');
    expect(live.state()).toBe('connecting');
    await tick();

    expect(live.state()).toBe('connected');
    expect(hubs[0].invoked).toEqual([{ method: 'Join', args: ['a1'] }]);
    hubs[0].send('BidPlaced', bid(1));
    hubs[0].send('AuctionStatusChanged', {
      auctionId: 'a1',
      status: 'FINISHED',
      endsAt: '2026-10-23T11:00:00Z',
    });
    expect(bids.map((b) => b.participantNumber)).toEqual([1]);
    expect(statuses[0].status).toBe('FINISHED');
  });

  it('shows the break while SignalR retries and asks the page to reload once it is back', async () => {
    const live = create();
    let resyncs = 0;
    live.resync$.subscribe(() => resyncs++);
    live.watch('a1');
    await tick();

    hubs[0].dropConnection();
    expect(live.state()).toBe('reconnecting');
    hubs[0].restoreConnection();
    await tick();

    expect(live.state()).toBe('connected');
    expect(hubs[0].invoked.filter((i) => i.method === 'Join').length).toBe(2); // the group is joined again
    expect(resyncs).toBe(1);
  });

  it('reports a connection that could not be made', async () => {
    const live = create(true);
    live.watch('a1');
    await tick();
    expect(live.state()).toBe('disconnected');
    expect(hubs[0].invoked).toEqual([]);
  });

  it('a hidden tab pauses the connection and a visible one resumes it with a reload', async () => {
    const live = create();
    let resyncs = 0;
    live.resync$.subscribe(() => resyncs++);
    live.watch('a1');
    await tick();

    setHidden(true);
    await tick();
    expect(hubs[0].stopped).toBe(1);

    setHidden(false);
    await tick();
    await tick();
    expect(hubs.length).toBe(2);
    expect(live.state()).toBe('connected');
    expect(resyncs).toBe(1);
  });

  it('stop ends the connection and the page no longer reacts to the tab', async () => {
    const live = create();
    live.watch('a1');
    await tick();
    live.stop();
    await tick();
    expect(live.state()).toBe('idle');
    expect(hubs[0].stopped).toBe(1);
    setHidden(false);
    await tick();
    expect(hubs.length).toBe(1);
  });
});

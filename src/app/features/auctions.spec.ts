import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { authInterceptor } from '../core/auth/auth.interceptor';
import { TokenStore } from '../core/auth/token-store';
import { Notify } from '../core/notify/notify.service';
import { AuctionDetail } from './auctions/auction-detail';
import { AuctionForm, auctionRules } from './auctions/auction-form';
import { ParticipantActions } from './participants/participant-actions';
import { HUB_FACTORY } from '../core/realtime/auction-live';
import { FakeHub } from '../testing/fake-hub';

const minutes = (n: number) => new Date(Date.now() + n * 60_000).toISOString();
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const ok = (data: unknown) => ({
  success: true,
  statusCode: 200,
  message: null,
  errors: null,
  data,
});
let hub: FakeHub;

function setup(routeParams: Record<string, string>, permissions: string[]) {
  localStorage.clear();
  hub = new FakeHub();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      providePrimeNG({}),
      MessageService,
      ConfirmationService,
      { provide: HUB_FACTORY, useValue: () => hub },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap(routeParams) } },
      },
    ],
  });
  TestBed.inject(TokenStore).set({
    accessToken: `x.${btoa(JSON.stringify({ permission: permissions }))}.y`,
    refreshToken: 'r',
    accessTokenExpiration: minutes(20),
    refreshTokenExpiration: minutes(60),
    userId: 'me',
  });
  return TestBed.inject(HttpTestingController);
}

describe('auctionRules', () => {
  const base = {
    startingPrice: 100,
    depositAmount: 10,
    applicationDeadline: '2099-01-01T10:00',
    startsAt: '2099-01-01T12:00',
    endsAt: '2099-01-01T14:00',
  };

  it('accepts a sound auction', () => {
    expect(auctionRules(base)).toEqual([]);
  });

  it('names every broken rule', () => {
    expect(auctionRules({ ...base, depositAmount: 100 })).toEqual(['deposit']);
    expect(auctionRules({ ...base, applicationDeadline: '2099-01-01T13:00' })).toEqual([
      'deadline',
    ]);
    expect(auctionRules({ ...base, endsAt: '2099-01-01T12:04' })).toEqual(['duration']);
    expect(
      auctionRules({
        ...base,
        startsAt: '2000-01-01T12:00',
        applicationDeadline: '2000-01-01T10:00',
        endsAt: '2000-01-01T14:00',
      }),
    ).toEqual(['future']);
  });
});

const property = { id: 'p1', title: 'Kvartira', status: 'PUBLISHED' };

describe('AuctionForm', () => {
  it('sends the times typed in Tashkent time as UTC and the numbers as numbers', async () => {
    const backend = setup({}, ['CREATE_AUCTION']);
    const fixture = TestBed.createComponent(AuctionForm);
    fixture.detectChanges();
    const page = fixture.componentInstance as unknown as {
      save(): void;
      form: { patchValue(v: Record<string, unknown>): void };
    };

    page.save();
    backend.expectNone('/api/Auction');

    page.form.patchValue({
      property,
      startingPrice: 100_000_000,
      minBidStep: 1_000_000,
      depositAmount: 5_000_000,
      applicationDeadline: '2099-06-01T10:00',
      startsAt: '2099-06-01T12:00',
      endsAt: '2099-06-01T14:00',
      extensionMinutes: 5,
    });
    page.save();
    const request = backend.expectOne((r) => r.method === 'POST' && r.url === '/api/Auction');
    const form = request.request.body as FormData;
    expect(form.get('PropertyId')).toBe('p1');
    expect(form.get('StartsAt')).toBe('2099-06-01T07:00:00.000Z'); // 12:00 in Tashkent
    expect(form.get('EndsAt')).toBe('2099-06-01T09:00:00.000Z');
    expect(form.get('ApplicationDeadline')).toBe('2099-06-01T05:00:00.000Z');
    expect(form.get('StartingPrice')).toBe('100000000');
    expect(form.get('OfferToRunnerUp')).toBe('true');
    expect(form.has('LotNumber')).toBe(false);
    request.flush(ok({ id: 'a1' }));
  });

  it('does not send an auction that breaks a rule and says which', async () => {
    setup({}, ['CREATE_AUCTION']);
    const fixture = TestBed.createComponent(AuctionForm);
    fixture.detectChanges();
    const page = fixture.componentInstance as unknown as {
      save(): void;
      form: { patchValue(v: Record<string, unknown>): void };
    };
    page.form.patchValue({
      property,
      startingPrice: 100,
      minBidStep: 1,
      depositAmount: 100,
      applicationDeadline: '2099-06-01T10:00',
      startsAt: '2099-06-01T12:00',
      endsAt: '2099-06-01T14:00',
    });
    page.save();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Zakalat boshlang‘ich narxdan kam bo‘lishi kerak',
    );
  });
});

const auction = (status: string, extra: Record<string, unknown> = {}) => ({
  id: 'a1',
  lotNumber: '2026-000001',
  title: 'Kvartira',
  description: null,
  propertyId: 'p1',
  status,
  startingPrice: 100_000_000,
  minBidStep: 1_000_000,
  depositAmount: 5_000_000,
  applicationDeadline: '2099-06-01T05:00:00Z',
  startsAt: '2099-06-01T07:00:00Z',
  endsAt: '2099-06-01T09:00:00Z',
  extensionMinutes: 5,
  currentPrice: null,
  leadingBidId: null,
  offerToRunnerUp: true,
  cancelReason: null,
  result: null,
  ...extra,
});

describe('AuctionDetail', () => {
  async function open(status: string, permissions: string[], extra: Record<string, unknown> = {}) {
    const backend = setup({ id: 'a1' }, permissions);
    const fixture = TestBed.createComponent(AuctionDetail);
    fixture.detectChanges();
    backend.expectOne((r) => r.url === '/api/Auction').flush(ok(auction(status, extra)));
    await fixture.whenStable();
    fixture.detectChanges();
    return {
      backend,
      fixture,
      el: fixture.nativeElement as HTMLElement,
      page: fixture.componentInstance as unknown as Record<string, (...a: unknown[]) => unknown>,
    };
  }

  it('a draft can be edited, published and deleted; the help explains it', async () => {
    const { el } = await open('DRAFT', ['READ_AUCTION', 'UPDATE_AUCTION', 'DELETE_AUCTION']);
    const text = el.textContent ?? '';
    expect(text).toContain('Tahrirlash');
    expect(text).toContain('E’lon qilish');
    expect(text).toContain('O‘chirish');
    expect(text).toContain('Qoralama: tahrirlash, o‘chirish va e’lon qilish mumkin');
    expect(text).not.toContain('Bekor qilish');
  });

  it('a running auction can only be cancelled', async () => {
    const { el } = await open('ONGOING', ['READ_AUCTION', 'UPDATE_AUCTION', 'DELETE_AUCTION']);
    const text = el.textContent ?? '';
    expect(text).toContain('Bekor qilish');
    expect(text).not.toContain('Tahrirlash');
    expect(text).not.toContain('E’lon qilish');
  });

  it('publishes after a confirmation and shows the new status', async () => {
    const { backend, fixture, page } = await open('DRAFT', ['READ_AUCTION', 'UPDATE_AUCTION']);
    vi.spyOn(TestBed.inject(Notify), 'confirm').mockResolvedValue(true);
    await (page['publish'] as () => Promise<void>)();
    const request = backend.expectOne('/api/Auction/publish');
    expect(request.request.body).toEqual({ id: 'a1' });
    request.flush(ok(auction('SCHEDULED')));
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'E’lon qilingan: arizalar qabul qilinmoqda',
    );
  });

  it('cancels only with a reason', async () => {
    const { backend, page } = await open('SCHEDULED', ['READ_AUCTION', 'UPDATE_AUCTION']);
    const dialog = page as unknown as { cancelReason: string };
    (page['openCancel'] as () => void)();
    (page['cancel'] as () => void)();
    backend.expectNone('/api/Auction/cancel');

    dialog.cancelReason = '  Obyekt egasi rad etdi ';
    (page['cancel'] as () => void)();
    const request = backend.expectOne('/api/Auction/cancel');
    expect(request.request.body).toEqual({ id: 'a1', reason: 'Obyekt egasi rad etdi' });
    request.flush(ok(auction('CANCELLED', { cancelReason: 'Obyekt egasi rad etdi' })));
  });

  it('shows how many applications the auction has', async () => {
    const { el } = await open('PUBLISHED', ['READ_AUCTION'], {
      participantCounts: {
        total: 7,
        pending: 3,
        approved: 3,
        rejected: 1,
        withdrawn: 0,
        depositPaid: 2,
      },
    });
    const counts = el.querySelector('.counts')?.textContent ?? '';
    expect(counts).toContain('Jami');
    expect(counts.replace(/\s+/g, ' ')).toMatch(/Jami\s*7/);
    expect(counts.replace(/\s+/g, ' ')).toMatch(/Zakalat to‘lagan\s*2/);
  });

  it('shows the result and who each offer is for', async () => {
    const result = {
      outcome: 'AWAITING_PAYMENT',
      finalPrice: 103_000_000,
      paymentDueAt: '2099-06-06T09:00:00Z',
      awards: [
        {
          id: 'w1',
          rank: 1,
          participantId: 'x',
          participantNumber: 3,
          userFullName: 'Ali Valiyev',
          userPhone: '+998901234567',
          price: 103_000_000,
          status: 'ACCEPTED',
          respondBy: null,
          paymentDueAt: '2099-06-06T09:00:00Z',
        },
      ],
    };
    const { el } = await open('FINISHED', ['READ_AUCTION'], { result });
    const text = el.textContent ?? '';
    expect(text).toContain('To‘lov kutilmoqda');
    expect(text).toContain('№3 · Ali Valiyev');
    expect(text).toContain('+998 90 123 45 67');
    expect(text).toContain('103 000 000 so‘m');
  });

  it('switching tabs forgets the page and sort of the previous table', async () => {
    const { page } = await open('SCHEDULED', ['READ_AUCTION']);
    await TestBed.inject(Router).navigateByUrl('/x?page=3&sort=Amount&dir=asc&q=ali');
    (page['selectTab'] as (v: string) => void)('participants');
    await tick();
    await tick();
    const url = TestBed.inject(Router).url;
    expect(url).not.toContain('page=');
    expect(url).not.toContain('sort=');
    expect(url).not.toContain('q=');
  });
});

describe('ParticipantActions', () => {
  const participant = (status: string) => ({ id: 'pt1', status });

  async function create(status: string, permissions: string[]) {
    const backend = setup({}, permissions);
    const fixture = TestBed.createComponent(ParticipantActions);
    fixture.componentRef.setInput('participant', participant(status));
    await fixture.whenStable();
    fixture.detectChanges();
    return {
      backend,
      fixture,
      el: fixture.nativeElement as HTMLElement,
      page: fixture.componentInstance as unknown as Record<string, (...a: unknown[]) => unknown> & {
        reason: string;
      },
    };
  }

  it('offers the buttons only for a pending application and only to those who may review', async () => {
    expect(
      (await create('PENDING', ['UPDATE_AUCTIONPARTICIPANT'])).el.querySelectorAll('p-button')
        .length,
    ).toBeGreaterThanOrEqual(2);
    TestBed.resetTestingModule();
    expect(
      (await create('APPROVED', ['UPDATE_AUCTIONPARTICIPANT'])).el.querySelectorAll(
        'p-button button, p-button',
      ).length,
    ).toBeLessThanOrEqual(2);
    TestBed.resetTestingModule();
    const noRight = await create('PENDING', ['READ_AUCTIONPARTICIPANT']);
    expect(noRight.el.textContent).not.toContain('Tasdiqlash');
    expect(noRight.el.querySelector('p-button[icon="pi pi-check"]')).toBeNull();
  });

  it('approves, and rejects only with a reason', async () => {
    const { backend, page, fixture } = await create('PENDING', ['UPDATE_AUCTIONPARTICIPANT']);
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);

    page['approve']();
    backend.expectOne('/api/Participation/approve').flush(ok({ id: 'pt1', status: 'APPROVED' }));
    expect(changed).toHaveBeenCalledTimes(1);

    page['open']();
    page.reason = '  Hujjat yetarli emas ';
    page['reject']();
    const reject = backend.expectOne('/api/Participation/reject');
    expect(reject.request.body).toEqual({ id: 'pt1', reason: 'Hujjat yetarli emas' });
    reject.flush(ok({ id: 'pt1', status: 'REJECTED' }));
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('shows the API reason when the review is closed', async () => {
    const { backend, page } = await create('PENDING', ['UPDATE_AUCTIONPARTICIPANT']);
    const error = vi.spyOn(TestBed.inject(Notify), 'error');
    page['approve']();
    backend
      .expectOne('/api/Participation/approve')
      .flush({ message: 'The sale has started' }, { status: 409, statusText: 'Conflict' });
    expect(error).toHaveBeenCalled();
  });
});

describe('AuctionDetail live', () => {
  async function open(status: string) {
    const backend = setup({ id: 'a1' }, ['READ_AUCTION', 'UPDATE_AUCTION']);
    const fixture = TestBed.createComponent(AuctionDetail);
    fixture.detectChanges();
    backend
      .expectOne((r) => r.url === '/api/Auction')
      .flush(ok(auction(status, { currentPrice: 100_000_000 })));
    await fixture.whenStable();
    await tick();
    fixture.detectChanges();
    return { backend, fixture, el: fixture.nativeElement as HTMLElement };
  }

  const event = (n: number, extra: Record<string, unknown> = {}) => ({
    auctionId: 'a1',
    participantNumber: n,
    amount: 101_000_000 + n,
    placedAt: '2026-10-23T09:30:00Z',
    currentPrice: 101_000_000 + n,
    minNextBid: 102_000_000 + n,
    endsAt: '2099-06-01T09:05:00Z',
    extended: true,
    bidCount: n,
    ...extra,
  });

  it('watches an open auction and shows the live state', async () => {
    const { fixture, el } = await open('ONGOING');
    expect(hub.invoked).toEqual([{ method: 'Join', args: ['a1'] }]);
    fixture.detectChanges();
    expect(el.textContent).toContain('Jonli');
  });

  it('does not connect for an auction that is over', async () => {
    await open('FINISHED');
    expect(hub.started).toBe(0);
  });

  it('a bid changes the price, the next minimum, the feed and the end time at once', async () => {
    const { fixture, el } = await open('ONGOING');
    hub.send('BidPlaced', event(3));
    fixture.detectChanges();
    const text = el.textContent ?? '';
    expect(text).toContain('101 000 003 so‘m'); // price and the bid in the feed
    expect(text).toContain('102 000 003 so‘m'); // next minimum
    expect(text).toContain('№3');
    expect(text).toContain('vaqt uzaytirildi');
  });

  it('a status change or a reconnection reloads the auction', async () => {
    const { backend } = await open('ONGOING');
    hub.send('AuctionStatusChanged', {
      auctionId: 'a1',
      status: 'FINISHED',
      endsAt: '2099-06-01T09:00:00Z',
    });
    backend.expectOne((r) => r.url === '/api/Auction').flush(ok(auction('FINISHED')));
    await tick();
    expect(hub.stopped).toBe(1); // nothing left to watch

    hub.send('BidPlaced', event(1)); // ignored by the page? the stream is closed by stop
  });

  it('after a break it loads everything again', async () => {
    const { backend } = await open('ONGOING');
    hub.dropConnection();
    hub.restoreConnection();
    await tick();
    backend.expectOne((r) => r.url === '/api/Auction').flush(ok(auction('ONGOING')));
  });
});

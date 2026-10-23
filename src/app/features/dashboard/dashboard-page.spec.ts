import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { authInterceptor } from '../../core/auth/auth.interceptor';
import { TokenStore } from '../../core/auth/token-store';
import { BarChart } from '../../shared/ui/charts/bar-chart';
import { DashboardPage } from './dashboard-page';

const minutes = (n: number) => new Date(Date.now() + n * 60_000).toISOString();
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const summary = {
  generatedAt: '2026-10-23T09:30:00Z',
  users: { total: 1234, newLast7Days: 12, byType: { INDIVIDUAL: 1000, LEGAL: 200, NONE: 34 } },
  propertiesByStatus: { PUBLISHED: 5 },
  auctionsByStatus: { ONGOING: 1 },
  pendingApplications: 7,
  payments: {
    pending: 3,
    paidDeposits: 50000000,
    paidFinalPayments: 115000000,
    pendingRefunds: 2,
    pendingRefundsAmount: 10000000,
  },
  sales: { soldCount: 4, revenue: 480000000 },
  ongoing: [
    {
      id: 'a1',
      lotNumber: '2026-000001',
      title: 'Kvartira',
      startsAt: '2026-10-23T05:00:00Z',
      endsAt: '2026-10-23T07:00:00Z',
      currentPrice: 120000000,
      participants: 5,
      bids: 9,
    },
  ],
  upcoming: [],
  awaitingPayment: [
    {
      auctionId: 'a2',
      lotNumber: '2026-000002',
      title: 'Yer',
      outcome: 'AWAITING_PAYMENT',
      finalPrice: 90000000,
      paymentDueAt: '2026-10-28T09:00:00Z',
    },
  ],
  last30Days: Array.from({ length: 30 }, (_, i) => ({
    date: `2026-09-${String(24 + (i % 6)).padStart(2, '0')}`,
    newUsers: i % 3,
    bids: i,
    paidAmount: i * 1000,
  })),
};

describe('DashboardPage', () => {
  let backend: HttpTestingController;

  function setup(permissions: string[]) {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        providePrimeNG({}),
      ],
    });
    TestBed.inject(TokenStore).set({
      accessToken: `x.${btoa(JSON.stringify({ permission: permissions }))}.y`,
      refreshToken: 'r',
      accessTokenExpiration: minutes(20),
      refreshTokenExpiration: minutes(60),
      userId: 'u',
    });
    backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => backend.verify());

  it('shows the totals, the 30-day charts and the auction lists', async () => {
    const { fixture, el } = setup(['READ_DASHBOARD']);
    backend.expectOne('/api/Dashboard/summary').flush({ data: summary });
    await fixture.whenStable();
    fixture.detectChanges();

    const text = el.textContent ?? '';
    expect(text).toContain('1 234');
    expect(text).toContain('Oxirgi 7 kunda: +12');
    expect(text).toContain('Jismoniy shaxs: 1000');
    expect(text).toContain('50 000 000 so‘m');
    expect(text).toContain('Summa: 10 000 000 so‘m');
    expect(text).toContain('Yangilangan: 23.10.2026 14:30');
    expect(text).toContain('2026-000001');
    expect(text).toContain('To‘lov kutilmoqda');
    expect(text).toContain('Hozircha yo‘q');
    expect(el.querySelectorAll('app-bar-chart').length).toBe(3);
  });

  it('without the dashboard permission shows a hint and asks the server for nothing', async () => {
    const { fixture, el } = setup(['READ_USER']);
    await fixture.whenStable();
    expect(el.textContent).toContain('ruxsat yo‘q');
  });

  it('a failed first load offers a retry', async () => {
    const { fixture, el } = setup(['READ_DASHBOARD']);
    backend
      .expectOne('/api/Dashboard/summary')
      .flush({}, { status: 500, statusText: 'Server Error' });
    await tick();
    fixture.detectChanges();
    expect(el.textContent).toContain('Ko‘rsatkichlarni yuklab bo‘lmadi');

    el.querySelectorAll('button').forEach((b) =>
      b.textContent?.includes('Yangilash') ? b.click() : null,
    );
    backend.expectOne('/api/Dashboard/summary').flush({ data: summary });
  });
});

describe('BarChart', () => {
  it('draws one bar per point, scaled to the largest, with a tooltip', async () => {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(BarChart);
    fixture.componentRef.setInput('points', [
      { label: '01.10', value: 0 },
      { label: '02.10', value: 5 },
      { label: '03.10', value: 10 },
    ]);
    fixture.componentRef.setInput('ariaLabel', 'Takliflar');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    const bars = Array.from(el.querySelectorAll('rect.bar'));
    expect(bars.length).toBe(3);
    expect(Number(bars[0].getAttribute('height'))).toBe(0);
    expect(Number(bars[2].getAttribute('height'))).toBeCloseTo(
      2 * Number(bars[1].getAttribute('height')),
      5,
    );
    expect(bars[2].querySelector('title')?.textContent).toBe('03.10: 10');
    expect(el.querySelector('svg')?.getAttribute('aria-label')).toBe('Takliflar');
  });
});

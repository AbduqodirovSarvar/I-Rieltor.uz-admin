import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AuditList } from './audit-list';
import { NotificationList } from '../notifications/notification-list';

const page = (data: unknown[]) => ({
  success: true,
  statusCode: 200,
  data,
  pageIndex: 1,
  pageSize: 10,
  totalCount: data.length,
});

describe('Audit and notification logs', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        providePrimeNG({}),
        MessageService,
        ConfirmationService,
      ],
    });
  });

  it('audit: newest first, shows who did it and the result, and the errors view filters on status', async () => {
    const fixture = TestBed.createComponent(AuditList);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    const req = http.expectOne((r) => r.url === '/api/AuditLog/list');
    expect(req.request.params.get('SortBy')).toBe('OccurredAt');
    expect(req.request.params.get('SortDirection')).toBe('desc');
    expect(req.request.params.has('Filters[statusCode.greaterthan]')).toBe(false);
    req.flush(
      page([
        {
          occurredAt: '2026-10-01T05:00:00Z',
          userId: 'u1',
          userFullName: 'Ali Valiyev',
          action: 'Auction.Create',
          method: 'POST',
          path: '/api/Auction/create',
          statusCode: 403,
          durationMs: 12,
        },
      ]),
    );
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Ali Valiyev');
    expect(el.querySelector('.code')?.getAttribute('data-tone')).toBe('warn');
    expect(el.querySelector('a[href="/users/u1"]')).not.toBeNull();

    (fixture.componentInstance as unknown as { setView(v: string): void }).setView('errors');
    fixture.detectChanges();
    const next = http.expectOne((r) => r.url === '/api/AuditLog/list');
    expect(next.request.params.get('Filters[statusCode.greaterthan]')).toBe('399');
    next.flush(page([]));
  });

  it('notifications: the failed view filters on status and the error is visible in the row', async () => {
    const fixture = TestBed.createComponent(NotificationList);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/Notification/list').flush(page([]));
    await fixture.whenStable();

    (fixture.componentInstance as unknown as { setView(v: string): void }).setView('failed');
    fixture.detectChanges();
    const req = http.expectOne((r) => r.url === '/api/Notification/list');
    expect(req.request.params.get('Filters[status.equals]')).toBe('FAILED');
    req.flush(
      page([
        {
          id: 'n1',
          userId: 'u1',
          userFullName: 'Vali',
          destination: '+998901112233',
          channel: 'SMS',
          type: 'OTP',
          status: 'FAILED',
          attempts: 3,
          lastError: 'Provider timeout',
          createdAt: '2026-10-01T05:00:00Z',
        },
      ]),
    );
    await fixture.whenStable();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Provider timeout');
    expect(text).toContain('+998901112233');
  });
});

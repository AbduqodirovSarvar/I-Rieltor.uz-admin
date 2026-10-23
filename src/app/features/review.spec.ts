import { Component } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { authInterceptor } from '../core/auth/auth.interceptor';
import { TokenStore } from '../core/auth/token-store';
import { Notify } from '../core/notify/notify.service';
import { FilterBar, FilterField, FilterValues } from '../shared/ui/filter-bar/filter-bar';
import { DocumentList } from './documents/document-list';
import { DocumentService } from './documents/document.service';
import { ParticipantList } from './participants/participant-list';

const minutes = (n: number) => new Date(Date.now() + n * 60_000).toISOString();
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const ok = (data: unknown) => ({
  success: true,
  statusCode: 200,
  message: null,
  errors: null,
  data,
});
const list = (items: unknown[]) => ({
  ...ok(items),
  pageIndex: 0,
  pageSize: 20,
  totalCount: items.length,
});

function setup(permissions: string[]) {
  localStorage.clear();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      providePrimeNG({}),
      MessageService,
      ConfirmationService,
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

const participant = (id: string, status = 'PENDING') => ({
  id,
  auctionId: 'a1',
  lotNumber: '2026-000001',
  auctionTitle: 'Kvartira',
  userId: `u-${id}`,
  userFullName: `Ali ${id}`,
  userIdentifier: '12345678901234',
  userPhone: '+998901234567',
  userEmail: 'ali@example.com',
  status,
  participantNumber: null,
  depositStatus: 'NOT_PAID',
  signerIdentifier: '12345678901234',
  signedAt: '2026-10-20T05:00:00Z',
  reviewedAt: null,
  rejectReason: null,
});

describe('FilterBar default value', () => {
  @Component({
    imports: [FilterBar],
    template: `<app-filter-bar [fields]="fields" (filtersChange)="emitted.push($event)" />`,
  })
  class Host {
    readonly fields: FilterField[] = [
      {
        key: 'status',
        label: 'Holat',
        type: 'select',
        options: [
          { value: 'PENDING', label: 'Kutilmoqda' },
          { value: 'APPROVED', label: 'Tasdiqlangan' },
        ],
        default: 'PENDING',
      },
    ];
    readonly emitted: FilterValues[] = [];
  }

  it('starts with the default, and "all" stays all after a reload', async () => {
    setup([]);
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.emitted[0]).toEqual({ 'status.equals': 'PENDING' });

    const bar = fixture.debugElement.query(By.directive(FilterBar))
      .componentInstance as unknown as { clear(): void };
    bar.clear();
    await sleep(30);
    expect(fixture.componentInstance.emitted.at(-1)).toEqual({});
    expect(TestBed.inject(Router).url).toContain('f.status=-');

    // A new page load with that address does not bring the default back.
    TestBed.resetTestingModule();
    setup([]);
    await TestBed.inject(Router).navigateByUrl('/x?f.status=-');
    const again = TestBed.createComponent(Host);
    await again.whenStable();
    again.detectChanges();
    expect(again.componentInstance.emitted[0]).toEqual({});
  });
});

describe('ParticipantList', () => {
  async function open(permissions = ['READ_AUCTIONPARTICIPANT', 'UPDATE_AUCTIONPARTICIPANT']) {
    const backend = setup(permissions);
    const fixture = TestBed.createComponent(ParticipantList);
    fixture.detectChanges();
    await fixture.whenStable();
    backend
      .expectOne((r) => r.url === '/api/Auction/list')
      .flush(list([{ id: 'a1', lotNumber: '2026-000001', title: 'Kvartira' }]));
    const first = backend.expectOne((r) => r.url === '/api/Participation/list');
    return {
      backend,
      fixture,
      first,
      el: fixture.nativeElement as HTMLElement,
      page: fixture.componentInstance as unknown as Record<string, (...a: unknown[]) => unknown>,
    };
  }

  it('asks for the pending applications, newest first, by default', async () => {
    const { first } = await open();
    expect(first.request.params.get('Filters[status.equals]')).toBe('PENDING');
    expect(first.request.params.get('SortBy')).toBe('CreatedAt');
    expect(first.request.params.get('SortDirection')).toBe('desc');
    first.flush(list([participant('1')]));
  });

  it('shows the applicant, the lot and the status', async () => {
    const { first, fixture, el } = await open();
    first.flush(list([participant('1'), participant('2', 'APPROVED')]));
    await fixture.whenStable();
    fixture.detectChanges();
    const text = el.textContent ?? '';
    expect(text).toContain('Ali 1');
    expect(text).toContain('+998 90 123 45 67');
    expect(text).toContain('2026-000001');
    expect(text).toContain('Kutilmoqda');
    expect(text).toContain('Tasdiqlangan');
    // Only a pending application can be ticked.
    expect(el.querySelectorAll('tbody input[type=checkbox]').length).toBe(1);
  });

  it('approves the selected applications one by one and reports the ones that failed', async () => {
    const { backend, first, fixture, page } = await open();
    first.flush(list([participant('1'), participant('2'), participant('3')]));
    await fixture.whenStable();

    page['selectPending']();
    vi.spyOn(TestBed.inject(Notify), 'confirm').mockResolvedValue(true);
    const error = vi.spyOn(TestBed.inject(Notify), 'error');
    const success = vi.spyOn(TestBed.inject(Notify), 'success');
    const done = (page['approveSelected'] as () => Promise<void>)();
    await done;

    backend
      .expectOne(
        (r) => r.url === '/api/Participation/approve' && (r.body as { id: string }).id === '1',
      )
      .flush(ok(participant('1', 'APPROVED')));
    await tick();
    backend
      .expectOne((r) => (r.body as { id: string }).id === '2')
      .flush({ message: 'The sale has started' }, { status: 409, statusText: 'Conflict' });
    await tick();
    backend
      .expectOne((r) => (r.body as { id: string }).id === '3')
      .flush(ok(participant('3', 'APPROVED')));
    await tick();

    expect(success).toHaveBeenCalledWith('2 ta ariza tasdiqlandi');
    expect(error).toHaveBeenCalled();
    backend.expectOne((r) => r.url === '/api/Participation/list').flush(list([]));
  });

  it('opens the application with the documents the applicant attached to this auction', async () => {
    const { backend, first, fixture, page } = await open();
    first.flush(list([participant('1')]));
    await fixture.whenStable();
    page['view'](participant('1'));
    const docs = backend.expectOne((r) => r.url === '/api/Document/list');
    expect(docs.request.params.get('Filters[ownerId.equals]')).toBe('u-1');
    expect(docs.request.params.get('Filters[auctionId.equals]')).toBe('a1');
    docs.flush(list([{ id: 'd1', originalName: 'pasport.pdf', contentType: 'application/pdf' }]));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(document.body.textContent).toContain('pasport.pdf');
    expect(document.body.textContent).toContain('12345678901234');
  });

  it('downloads the signature of an application with the token, as a .p7s file', async () => {
    const { backend, first, fixture, page } = await open();
    first.flush(list([participant('1')]));
    await fixture.whenStable();
    const saved: string[] = [];
    URL.createObjectURL = () => 'blob:x';
    URL.revokeObjectURL = () => undefined;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved.push(this.download);
    });
    page['downloadSignature'](participant('1'));
    const request = backend.expectOne((r) => r.url === '/api/Participation/signed-application');
    expect(request.request.params.get('id')).toBe('1');
    expect(request.request.headers.get('Authorization')).toMatch(/^Bearer /);
    request.flush(new Blob(['x'], { type: 'application/pkcs7-signature' }));
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatch(/^ariza-.*\.p7s$/);
  });
});

describe('DocumentList', () => {
  const doc = {
    id: 'd1',
    ownerId: 'u1',
    ownerFullName: 'Ali Valiyev',
    purpose: 'PAYMENT_RECEIPT',
    originalName: 'chek.pdf',
    contentType: 'application/pdf',
    size: 2048,
    createdAt: '2026-10-22T05:00:00Z',
  };

  it('lists the documents with their owner, size and purpose', async () => {
    const backend = setup(['READ_PRIVATEDOCUMENT']);
    const fixture = TestBed.createComponent(DocumentList);
    fixture.detectChanges();
    await fixture.whenStable();
    backend.expectOne((r) => r.url === '/api/Document/list').flush(list([doc]));
    await fixture.whenStable();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('chek.pdf');
    expect(text).toContain('Ali Valiyev');
    expect(text).toContain('To‘lov cheki');
    expect(text).toContain('2 KB');
    expect(text).not.toContain('O‘chirish');
  });

  it('fetches the file with the token to view it, and deletes with the id in the body', async () => {
    const backend = setup(['READ_PRIVATEDOCUMENT', 'DELETE_PRIVATEDOCUMENT']);
    const fixture = TestBed.createComponent(DocumentList);
    fixture.detectChanges();
    await fixture.whenStable();
    backend.expectOne((r) => r.url === '/api/Document/list').flush(list([doc]));

    const opened = vi.spyOn(window, 'open').mockReturnValue(null);
    URL.createObjectURL = () => 'blob:x';
    URL.revokeObjectURL = () => undefined;
    TestBed.inject(DocumentService).open(doc);
    const download = backend.expectOne((r) => r.url === '/api/Document/download');
    expect(download.request.params.get('id')).toBe('d1');
    expect(download.request.headers.get('Authorization')).toMatch(/^Bearer /);
    download.flush(new Blob(['%PDF'], { type: 'application/pdf' }));
    expect(opened).toHaveBeenCalled();

    vi.spyOn(TestBed.inject(Notify), 'confirmDelete').mockResolvedValue(true);
    await (fixture.componentInstance as unknown as { remove(d: unknown): Promise<void> }).remove(
      doc,
    );
    const del = backend.expectOne((r) => r.method === 'DELETE');
    expect(del.request.body).toEqual({ id: 'd1' });
    del.flush(ok(true));
    await tick();
    backend.expectOne((r) => r.url === '/api/Document/list').flush(list([]));
  });
});

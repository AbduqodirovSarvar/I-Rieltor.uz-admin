import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { authInterceptor } from '../core/auth/auth.interceptor';
import { TokenStore } from '../core/auth/token-store';
import { Notify } from '../core/notify/notify.service';
import { PaymentConfirmDialog } from './payments/payment-confirm-dialog';
import { PaymentList } from './payments/payment-list';
import { PaymentManualDialog } from './payments/payment-manual-dialog';
import { Payment, isHandRecorded } from './payments/payment.service';

const minutes = (n: number) => new Date(Date.now() + n * 60_000).toISOString();
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
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

const payment = (id: string, extra: Partial<Record<keyof Payment, unknown>> = {}) =>
  ({
    id,
    userId: 'u1',
    userFullName: 'Ali Valiyev',
    userPhone: '+998901234567',
    auctionId: 'a1',
    lotNumber: '2026-000001',
    auctionTitle: 'Kvartira',
    participantId: 'pt1',
    purpose: 'DEPOSIT',
    amount: 5_000_000,
    status: 'PENDING',
    provider: 'CARD_TRANSFER',
    providerTransactionId: null,
    paidAt: null,
    note: null,
    receipts: [],
    createdAt: '2026-10-22T05:00:00Z',
    ...extra,
  }) as unknown as Payment;

describe('isHandRecorded', () => {
  it('is true for the money the staff confirm and false for Payme and Click', () => {
    expect(
      ['BANK_TRANSFER', 'CARD_TRANSFER', 'MANUAL'].every((provider) =>
        isHandRecorded({ provider } as Payment),
      ),
    ).toBe(true);
    expect(
      ['PAYME', 'CLICK', 'UZUM'].some((provider) => isHandRecorded({ provider } as Payment)),
    ).toBe(false);
  });
});

describe('PaymentList', () => {
  async function open(permissions = ['READ_PAYMENT', 'UPDATE_PAYMENT', 'CREATE_PAYMENT']) {
    const backend = setup(permissions);
    const fixture = TestBed.createComponent(PaymentList);
    fixture.detectChanges();
    await fixture.whenStable();
    return {
      backend,
      fixture,
      el: fixture.nativeElement as HTMLElement,
      page: fixture.componentInstance as unknown as Record<string, (...a: unknown[]) => unknown>,
    };
  }

  it('shows the payer, the lot and the paperclip with the number of receipts', async () => {
    const { backend, fixture, el } = await open();
    backend
      .expectOne((r) => r.url === '/api/Payment/list')
      .flush(list([payment('p1', { receipts: [{ id: 'd1' }, { id: 'd2' }] })]));
    await fixture.whenStable();
    fixture.detectChanges();
    const text = el.textContent ?? '';
    expect(text).toContain('Ali Valiyev');
    expect(text).toContain('2026-000001');
    expect(text).toContain('Kartaga o‘tkazma');
    expect(text).toContain('5 000 000 so‘m');
    expect(el.querySelector('.count')?.textContent).toContain('2');
  });

  it('the quick views ask for the right filters', async () => {
    const { backend, fixture, page } = await open();
    backend.expectOne((r) => r.url === '/api/Payment/list').flush(list([]));

    page['setView']('pending');
    fixture.detectChanges();
    await tick();
    let request = backend.expectOne((r) => r.url === '/api/Payment/list');
    expect(request.request.params.get('Filters[status.equals]')).toBe('PENDING');
    expect(request.request.params.get('Filters[purpose.notequals]')).toBe('REFUND');
    request.flush(list([]));

    page['setView']('refunds');
    fixture.detectChanges();
    await tick();
    request = backend.expectOne((r) => r.url === '/api/Payment/list');
    expect(request.request.params.get('Filters[purpose.equals]')).toBe('REFUND');
    expect(request.request.params.get('Filters[status.equals]')).toBe('PENDING');
    request.flush(list([]));
  });

  it('offers to confirm only a pending hand-recorded payment and to complete only a pending refund', async () => {
    const { page } = await open();
    expect(page['canConfirm'](payment('1'))).toBe(true);
    expect(page['canConfirm'](payment('2', { status: 'PAID' }))).toBe(false);
    expect(page['canConfirm'](payment('3', { provider: 'PAYME' }))).toBe(false);
    expect(page['canConfirm'](payment('4', { purpose: 'REFUND' }))).toBe(false);
    expect(page['canCompleteRefund'](payment('5', { purpose: 'REFUND', provider: 'MANUAL' }))).toBe(
      true,
    );
    expect(page['canCompleteRefund'](payment('6', { purpose: 'REFUND', status: 'PAID' }))).toBe(
      false,
    );
  });

  it('without the update permission the row has no confirm button', async () => {
    const { backend, fixture, el } = await open(['READ_PAYMENT']);
    backend.expectOne((r) => r.url === '/api/Payment/list').flush(list([payment('p1')]));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).not.toContain('To‘langan deb belgilash');
    expect(el.textContent).not.toContain('To‘lovni qo‘lda kiritish');
  });
});

describe('PaymentConfirmDialog', () => {
  function create(mode: 'confirm' | 'refund', extra: Partial<Record<keyof Payment, unknown>> = {}) {
    const backend = setup(['UPDATE_PAYMENT']);
    const fixture = TestBed.createComponent(PaymentConfirmDialog);
    fixture.componentRef.setInput(
      'payment',
      payment('p1', {
        receipts: [
          {
            id: 'd1',
            originalName: 'chek.pdf',
            contentType: 'application/pdf',
            size: 10,
            ownerId: 'u1',
            description: null,
            createdAt: '2026-10-22T05:00:00Z',
          },
        ],
        ...extra,
      }),
    );
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    const dialog = fixture.componentInstance as unknown as Record<string, unknown> & {
      reference: string;
    };
    (dialog['opened'] as () => void)();
    return { backend, fixture, dialog };
  }

  it('confirms with the bank reference (blank becomes null)', async () => {
    const { backend, fixture, dialog } = create('confirm');
    const done = vi.fn();
    fixture.componentInstance.done.subscribe(done);
    dialog.reference = ' TT-100 ';
    (dialog['submit'] as () => void)();
    const request = backend.expectOne('/api/Payment/confirm');
    expect(request.request.body).toEqual({ id: 'p1', reference: 'TT-100' });
    request.flush(ok(payment('p1', { status: 'PAID' })));
    expect(done).toHaveBeenCalled();
    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('completes a refund through its own endpoint', async () => {
    const { backend, dialog } = create('refund', { purpose: 'REFUND' });
    dialog.reference = '';
    (dialog['submit'] as () => void)();
    const request = backend.expectOne('/api/Payment/refund/complete');
    expect(request.request.body).toEqual({ id: 'p1', reference: null });
    request.flush(ok(payment('p1', { status: 'PAID', purpose: 'REFUND' })));
  });

  it('attaches the checks to the payment, one by one, before the money is confirmed', async () => {
    const { backend, dialog } = create('confirm');
    (dialog['picked'] as (f: File[]) => void)([
      new File([new Uint8Array(5)], 'a.pdf'),
      new File([new Uint8Array(5)], 'b.png'),
    ]);
    const done = (dialog['attach'] as () => Promise<void>)();
    await tick();
    let upload = backend.expectOne('/api/Document');
    expect((upload.request.body as FormData).get('PaymentId')).toBe('p1');
    expect((upload.request.body as FormData).get('Purpose')).toBe('PAYMENT_RECEIPT');
    upload.flush(
      ok({
        id: 'd2',
        originalName: 'a.pdf',
        contentType: 'application/pdf',
        size: 5,
        ownerId: 'me',
        createdAt: '2026-10-22T06:00:00Z',
      }),
    );
    await tick();
    upload = backend.expectOne('/api/Document');
    upload.flush(
      ok({
        id: 'd3',
        originalName: 'b.png',
        contentType: 'image/png',
        size: 5,
        ownerId: 'me',
        createdAt: '2026-10-22T06:00:00Z',
      }),
    );
    await done;
    expect((dialog['receipts'] as () => unknown[])().length).toBe(3);
  });

  it('shows the refusal when the payment was already confirmed', async () => {
    const { backend, dialog } = create('confirm');
    const error = vi.spyOn(TestBed.inject(Notify), 'error');
    (dialog['submit'] as () => void)();
    backend
      .expectOne('/api/Payment/confirm')
      .flush({ message: 'The payment is already PAID.' }, { status: 409, statusText: 'Conflict' });
    expect(error).toHaveBeenCalled();
  });
});

describe('PaymentManualDialog', () => {
  const auction = (extra: Record<string, unknown> = {}) => ({
    id: 'a1',
    lotNumber: '2026-000001',
    title: 'Kvartira',
    depositAmount: 5_000_000,
    result: null,
    ...extra,
  });
  const person = (id: string, deposit = 'PAID') => ({
    id,
    participantNumber: 1,
    userFullName: 'Ali Valiyev',
    status: 'APPROVED',
    depositStatus: deposit,
  });

  async function create() {
    const backend = setup(['CREATE_PAYMENT']);
    const fixture = TestBed.createComponent(PaymentManualDialog);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    const dialog = fixture.componentInstance as unknown as Record<
      string,
      (...a: unknown[]) => unknown
    >;
    dialog['opened']();
    return { backend, fixture, dialog };
  }

  async function choose(
    backend: HttpTestingController,
    dialog: Record<string, (...a: unknown[]) => unknown>,
    full: Record<string, unknown>,
    deposit = 'PAID',
  ) {
    dialog['chose'](auction());
    backend.expectOne((r) => r.url === '/api/Auction').flush(ok(full));
    const people = backend.expectOne((r) => r.url === '/api/Participation/list');
    expect(people.request.params.get('Filters[auctionId.equals]')).toBe('a1');
    expect(people.request.params.get('Filters[status.equals]')).toBe('APPROVED');
    people.flush(list([person('pt1', deposit)]));
    await tick();
    (dialog['participantId'] as unknown as { set(v: string): void }).set('pt1');
  }

  it('expects exactly the deposit for a deposit', async () => {
    const { backend, dialog } = await create();
    await choose(backend, dialog, auction());
    expect((dialog['expected'] as () => number | null)()).toBe(5_000_000);
    expect((dialog['canSave'] as () => boolean)()).toBe(true);
  });

  it('expects the price less the deposit for the final payment, and refuses it when the person bought nothing', async () => {
    const { backend, dialog } = await create();
    const award = { participantId: 'pt1', status: 'ACCEPTED', price: 103_000_000 };
    await choose(backend, dialog, auction({ result: { awards: [award] } }));
    (dialog['purpose'] as unknown as { set(v: string): void }).set('FINAL_PAYMENT');
    expect((dialog['expected'] as () => number | null)()).toBe(98_000_000);

    (dialog['participantId'] as unknown as { set(v: string): void }).set('someone-else');
    expect((dialog['expected'] as () => number | null)()).toBeNull();
    expect((dialog['canSave'] as () => boolean)()).toBe(false);
  });

  it('records the payment with the exact amount and attaches the check', async () => {
    const { backend, fixture, dialog } = await create();
    await choose(backend, dialog, auction());
    (dialog['picked'] as (f: File[]) => void)([new File([new Uint8Array(5)], 'chek.pdf')]);
    const done = vi.fn();
    fixture.componentInstance.done.subscribe(done);
    (dialog as unknown as { reference: string }).reference = 'KARTA-1';

    dialog['save']();
    const request = backend.expectOne('/api/Payment/manual');
    expect(request.request.body).toEqual({
      participantId: 'pt1',
      purpose: 'DEPOSIT',
      amount: 5_000_000,
      provider: 'CARD_TRANSFER',
      reference: 'KARTA-1',
      note: null,
    });
    request.flush(ok(payment('new', { status: 'PAID' })));
    const upload = backend.expectOne('/api/Document');
    expect((upload.request.body as FormData).get('PaymentId')).toBe('new');
    upload.flush(ok({ id: 'd9' }));
    expect(done).toHaveBeenCalled();
    expect(fixture.componentInstance.visible()).toBe(false);
  });
});

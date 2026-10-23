import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { components } from '../../api/schema';
import { ApiClient } from '../../core/http/api-client';
import { ListQuery, Page } from '../../core/http/response-model';

export type Payment = components['schemas']['PaymentViewModel'];
export type PaymentReceipt = components['schemas']['PaymentReceiptViewModel'];
export type PaymentProvider = components['schemas']['PaymentProvider'];
export type PaymentPurpose = components['schemas']['PaymentPurpose'];

/** Providers whose money the staff confirm by hand (Payme and Click report their own). */
export const HAND_PROVIDERS: readonly PaymentProvider[] = [
  'BANK_TRANSFER',
  'CARD_TRANSFER',
  'MANUAL',
];

export function isHandRecorded(payment: Pick<Payment, 'provider'>): boolean {
  return HAND_PROVIDERS.includes(payment.provider);
}

export interface ManualPaymentInput {
  participantId: string;
  purpose: 'DEPOSIT' | 'FINAL_PAYMENT';
  amount: number;
  provider: 'BANK_TRANSFER' | 'CARD_TRANSFER' | 'MANUAL';
  reference: string;
  note: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly api = inject(ApiClient);

  list(query: ListQuery): Observable<Page<Payment>> {
    return this.api.getPage<Payment>('api/Payment/list', query);
  }

  /** The payments of one auction. */
  ofAuction(auctionId: string, query: ListQuery): Observable<Page<Payment>> {
    return this.list({ ...query, filters: { ...query.filters, 'auctionId.equals': auctionId } });
  }

  /** A bank / card transfer arrived: the payment counts and the deposit or the purchase is settled. */
  confirm(id: string, reference: string): Observable<Payment> {
    return this.api.post<Payment>('api/Payment/confirm', {
      id,
      reference: reference.trim() || null,
    });
  }

  recordManual(input: ManualPaymentInput): Observable<Payment> {
    return this.api.post<Payment>('api/Payment/manual', {
      participantId: input.participantId,
      purpose: input.purpose,
      amount: input.amount,
      provider: input.provider,
      reference: input.reference.trim() || null,
      note: input.note.trim() || null,
    });
  }

  /** The money of a queued refund was sent back. */
  completeRefund(id: string, reference: string): Observable<Payment> {
    return this.api.post<Payment>('api/Payment/refund/complete', {
      id,
      reference: reference.trim() || null,
    });
  }
}

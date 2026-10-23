import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { components } from '../../api/schema';
import { ApiClient } from '../../core/http/api-client';
import { plainParams } from '../../core/http/query-params';
import { ListQuery, Page } from '../../core/http/response-model';

export type Auction = components['schemas']['AuctionViewModel'];
export type AuctionResult = components['schemas']['AuctionResultViewModel'];
export type AuctionAward = components['schemas']['AuctionAwardViewModel'];
export type AuctionStatus = components['schemas']['AuctionStatus'];
export type PublicBid = components['schemas']['PublicBidViewModel'];

/** Times are ISO UTC strings (the form converts from Tashkent time). */
export interface AuctionInput {
  propertyId: string;
  lotNumber: string;
  title: string;
  description: string;
  startingPrice: number;
  minBidStep: number;
  depositAmount: number;
  applicationDeadline: string;
  startsAt: string;
  endsAt: string;
  extensionMinutes: number;
  offerToRunnerUp: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuctionService {
  private readonly api = inject(ApiClient);

  list(query: ListQuery): Observable<Page<Auction>> {
    return this.api.getPage<Auction>('api/Auction/list', query);
  }

  /** With the result and the offers once the sale is over. */
  get(id: string): Observable<Auction> {
    return this.api.get<Auction>('api/Auction', plainParams({ Id: id }));
  }

  create(input: AuctionInput): Observable<Auction> {
    return this.api.postForm<Auction>('api/Auction', this.form(input));
  }

  /** Only a draft can be changed (the API answers 409 otherwise). */
  update(id: string, input: AuctionInput): Observable<Auction> {
    const form = this.form(input);
    form.append('Id', id);
    return this.api.putForm<Auction>('api/Auction', form);
  }

  delete(id: string): Observable<boolean> {
    return this.api.delete<boolean>('api/Auction', { id });
  }

  publish(id: string): Observable<Auction> {
    return this.api.post<Auction>('api/Auction/publish', { id });
  }

  cancel(id: string, reason: string): Observable<Auction> {
    return this.api.post<Auction>('api/Auction/cancel', { id, reason });
  }

  bids(auctionId: string, query: ListQuery): Observable<Page<PublicBid>> {
    return this.api.getPage<PublicBid>('api/Bid/list', {
      ...query,
      extra: { AuctionId: auctionId },
    });
  }

  private form(input: AuctionInput): FormData {
    const form = new FormData();
    form.append('PropertyId', input.propertyId);
    form.append('StartingPrice', String(input.startingPrice));
    form.append('MinBidStep', String(input.minBidStep));
    form.append('DepositAmount', String(input.depositAmount));
    form.append('ApplicationDeadline', input.applicationDeadline);
    form.append('StartsAt', input.startsAt);
    form.append('EndsAt', input.endsAt);
    form.append('ExtensionMinutes', String(input.extensionMinutes));
    form.append('OfferToRunnerUp', String(input.offerToRunnerUp));
    if (input.lotNumber.trim()) form.append('LotNumber', input.lotNumber.trim());
    if (input.title.trim()) form.append('Title', input.title.trim());
    if (input.description.trim()) form.append('Description', input.description.trim());
    return form;
  }
}

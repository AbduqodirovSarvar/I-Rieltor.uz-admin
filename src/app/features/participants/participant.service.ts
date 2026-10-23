import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { components } from '../../api/schema';
import { ApiClient } from '../../core/http/api-client';
import { ListQuery, Page } from '../../core/http/response-model';

export type Participant = components['schemas']['ParticipantAdminViewModel'];

@Injectable({ providedIn: 'root' })
export class ParticipantService {
  private readonly api = inject(ApiClient);

  list(query: ListQuery): Observable<Page<Participant>> {
    return this.api.getPage<Participant>('api/Participation/list', query);
  }

  /** The applications of one auction. */
  ofAuction(auctionId: string, query: ListQuery): Observable<Page<Participant>> {
    return this.list({ ...query, filters: { ...query.filters, 'auctionId.equals': auctionId } });
  }

  approve(id: string): Observable<Participant> {
    return this.api.post<Participant>('api/Participation/approve', { id });
  }

  reject(id: string, reason: string): Observable<Participant> {
    return this.api.post<Participant>('api/Participation/reject', { id, reason });
  }
}

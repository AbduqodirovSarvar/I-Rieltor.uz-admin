import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { components } from '../../api/schema';
import { ApiClient } from '../../core/http/api-client';
import { saveBlob } from '../../core/http/download';
import { plainParams } from '../../core/http/query-params';
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

  /** The E-IMZO signature of the application as a file (.p7s), fetched with the token. */
  downloadSignature(participant: Pick<Participant, 'id' | 'participantNumber'>): void {
    this.api
      .blob('api/Participation/signed-application', plainParams({ id: participant.id }))
      .subscribe((blob) =>
        saveBlob(blob, `ariza-${participant.participantNumber ?? participant.id.slice(0, 8)}.p7s`),
      );
  }

  approve(id: string): Observable<Participant> {
    return this.api.post<Participant>('api/Participation/approve', { id });
  }

  reject(id: string, reason: string): Observable<Participant> {
    return this.api.post<Participant>('api/Participation/reject', { id, reason });
  }
}

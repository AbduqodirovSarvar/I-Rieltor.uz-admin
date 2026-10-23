import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { components } from '../../api/schema';
import { ApiClient } from '../../core/http/api-client';

export type DashboardSummary = components['schemas']['DashboardSummary'];
export type DashboardAuction = components['schemas']['DashboardAuction'];
export type DashboardAwaitingPayment = components['schemas']['DashboardAwaitingPayment'];
export type DashboardDay = components['schemas']['DashboardDay'];

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiClient);

  /** The backend caches the numbers for 30 seconds. */
  summary(): Observable<DashboardSummary> {
    return this.api.get<DashboardSummary>('api/Dashboard/summary');
  }
}

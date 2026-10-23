import { HttpParams } from '@angular/common/http';
import { ListQuery } from './response-model';

type ParamValue = string | number | boolean | null | undefined;

/** Builds the query string of a list call: `PageIndex`, `PageSize`, `SearchText`, `SortBy`, `SortDirection`, `Filters[status.equals]`. */
export function listParams(query: ListQuery = {}): HttpParams {
  let params = new HttpParams();
  const set = (name: string, value: ParamValue) => {
    if (value === null || value === undefined || value === '') return;
    params = params.set(name, String(value));
  };
  set('PageIndex', query.pageIndex);
  set('PageSize', query.pageSize);
  set('SearchText', query.searchText?.trim());
  set('SortBy', query.sortBy);
  if (query.sortBy) set('SortDirection', query.sortDirection);
  for (const [key, value] of Object.entries(query.filters ?? {})) set(`Filters[${key}]`, value);
  for (const [key, value] of Object.entries(query.extra ?? {})) set(key, value);
  return params;
}

/** Plain parameters (ids and the like); empty values are left out. */
export function plainParams(values: Record<string, ParamValue>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === '') continue;
    params = params.set(key, String(value));
  }
  return params;
}

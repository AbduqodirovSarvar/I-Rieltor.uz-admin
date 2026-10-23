/** The envelope every backend endpoint answers with. `statusCode` is always a number. */
export interface ResponseModel<T> {
  success: boolean;
  statusCode: number;
  message: string | null;
  errors: string[] | null;
  data: T;
  pageIndex?: number;
  pageSize?: number;
  totalCount?: number;
  isPaginated?: boolean;
}

/** One page of a list endpoint. */
export interface Page<T> {
  items: T[];
  pageIndex: number;
  pageSize: number;
  totalCount: number;
}

export type FilterOperator =
  'equals' | 'notequals' | 'contains' | 'startswith' | 'endswith' | 'greaterthan' | 'lessthan';

/** What every list endpoint accepts (BaseGetListQuery). `filters` keys look like `status.equals`. */
export interface ListQuery {
  pageIndex?: number;
  pageSize?: number;
  searchText?: string | null;
  sortBy?: string | null;
  sortDirection?: 'asc' | 'desc';
  filters?: Record<string, string | number | boolean | null | undefined>;
  /** Plain extra parameters some list endpoints need (for example `AuctionId` of the bid list). */
  extra?: Record<string, string | number | boolean | null | undefined>;
}

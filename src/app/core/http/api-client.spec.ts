import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from './api-client';
import { ApiError } from './api-error';

const ok = <T>(data: T) => ({ success: true, statusCode: 200, message: null, errors: null, data });

describe('ApiClient', () => {
  let api: ApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('returns the data of the envelope', () => {
    let result: unknown;
    api.get<{ id: string }>('api/Company/public').subscribe((value) => (result = value));
    http.expectOne('/api/Company/public').flush(ok({ id: 'a' }));
    expect(result).toEqual({ id: 'a' });
  });

  it('builds the list query and reads the paging fields', () => {
    let page: unknown;
    api
      .getPage('api/Auction/list', {
        pageIndex: 1,
        pageSize: 10,
        searchText: ' lot ',
        sortBy: 'CreatedAt',
        sortDirection: 'asc',
        filters: { 'status.equals': 'ONGOING', empty: '' },
      })
      .subscribe((value) => (page = value));
    const request = http.expectOne((r) => r.url === '/api/Auction/list');
    expect(request.request.params.get('PageIndex')).toBe('1');
    expect(request.request.params.get('SearchText')).toBe('lot');
    expect(request.request.params.get('SortDirection')).toBe('asc');
    expect(request.request.params.get('Filters[status.equals]')).toBe('ONGOING');
    expect(request.request.params.has('Filters[empty]')).toBe(false);
    request.flush({
      ...ok([{ id: 1 }]),
      pageIndex: 1,
      pageSize: 10,
      totalCount: 31,
      isPaginated: true,
    });
    expect(page).toEqual({ items: [{ id: 1 }], pageIndex: 1, pageSize: 10, totalCount: 31 });
  });

  it('sends the id of a DELETE in the body', () => {
    api.delete('api/Slide', { id: 'x' }).subscribe();
    const request = http.expectOne('/api/Slide');
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toEqual({ id: 'x' });
    request.flush(ok(true));
  });

  it('turns a 400 into an ApiError with the field errors and the request id', () => {
    let error: ApiError | undefined;
    api.post('api/Slide', {}).subscribe({ error: (e) => (error = e) });
    http.expectOne('/api/Slide').flush(
      {
        success: false,
        statusCode: 400,
        message: 'One or more validation errors occurred.',
        errors: ['Title: is required', 'Order: out of range'],
      },
      { status: 400, statusText: 'Bad Request', headers: { 'X-Request-ID': 'req-1' } },
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error?.isValidation).toBe(true);
    expect(error?.requestId).toBe('req-1');
    expect(error?.fieldErrors()).toEqual({ Title: ['is required'], Order: ['out of range'] });
  });

  it('reads Retry-After of a 429 and flags network failures', () => {
    let limited: ApiError | undefined;
    let offline: ApiError | undefined;
    api.get('api/a').subscribe({ error: (e) => (limited = e) });
    http
      .expectOne('/api/a')
      .flush(
        { message: 'Too many requests' },
        { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '12' } },
      );
    api.get('api/b').subscribe({ error: (e) => (offline = e) });
    http.expectOne('/api/b').error(new ProgressEvent('error'));
    expect(limited?.status).toBe(429);
    expect(limited?.retryAfter).toBe(12);
    expect(offline?.isNetwork).toBe(true);
  });
});

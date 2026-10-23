import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { Observable, of, throwError } from 'rxjs';
import { ApiError } from '../../../core/http/api-error';
import { ListQuery, Page } from '../../../core/http/response-model';
import { Notify } from '../../../core/notify/notify.service';
import { CellTemplate, DataTable, RowActionsTemplate, TableColumn } from './data-table';

interface Row {
  id: string;
  title: string;
  status: string;
  price: number;
  createdAt: string;
}

const rows: Row[] = [
  {
    id: '1',
    title: 'Kvartira',
    status: 'ONGOING',
    price: 120000000,
    createdAt: '2026-10-23T09:30:00Z',
  },
  {
    id: '2',
    title: 'Yer uchastkasi',
    status: 'DRAFT',
    price: 5000,
    createdAt: '2026-10-22T09:30:00Z',
  },
];

const columns: TableColumn<Row>[] = [
  { field: 'title', header: 'Nomi' },
  { field: 'status', header: 'Holat', type: 'enum', enumName: 'AuctionStatus' },
  { field: 'price', header: 'Narx', type: 'money', align: 'right' },
  { field: 'createdAt', header: 'Sana', type: 'datetime', sortField: false },
  { field: 'badge', header: 'Maxsus', type: 'custom', sortField: false },
];

@Component({
  imports: [DataTable, CellTemplate, RowActionsTemplate],
  template: `
    <app-data-table
      [columns]="columns"
      [fetch]="fetch"
      [filters]="filters()"
      [reloadKey]="reloadKey()"
    >
      <ng-template appCell="badge" let-row
        ><b class="custom">#{{ row.id }}</b></ng-template
      >
      <ng-template appRowActions let-row
        ><button class="act">{{ row.id }}</button></ng-template
      >
    </app-data-table>
  `,
})
class Host {
  readonly columns = columns;
  readonly filters = signal<Record<string, string>>({});
  readonly reloadKey = signal(0);
  calls: ListQuery[] = [];
  next: () => Observable<Page<Row>> = () =>
    of({ items: rows, pageIndex: 0, pageSize: 20, totalCount: 45 });
  readonly fetch = (query: ListQuery): Observable<Page<Row>> => {
    this.calls.push(query);
    return this.next();
  };
}

interface TableApi {
  onPage(event: { first: number; rows: number }): void;
  onSearch(text: string): void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('DataTable', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), providePrimeNG({}), MessageService, ConfirmationService],
    });
  });

  async function create() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    const table = fixture.debugElement.query(By.directive(DataTable))
      .componentInstance as unknown as TableApi;
    return {
      fixture,
      host: fixture.componentInstance,
      el: fixture.nativeElement as HTMLElement,
      table,
    };
  }

  it('loads the first page and shows formatted cells, status tags, custom cells and row actions', async () => {
    const { host, el } = await create();

    expect(host.calls[0]).toMatchObject({
      pageIndex: 0,
      pageSize: 20,
      sortBy: 'CreatedAt',
      sortDirection: 'desc',
    });
    const text = el.textContent ?? '';
    expect(text).toContain('Kvartira');
    expect(text).toContain('Savdo ketmoqda');
    expect(text).toContain('120 000 000 so‘m');
    expect(text).toContain('23.10.2026 14:30');
    expect(el.querySelectorAll('.custom').length).toBe(2);
    expect(el.querySelectorAll('.act').length).toBe(2);
  });

  it('asks for another page, a sorted list and a searched list', async () => {
    const { host, table, el } = await create();

    table.onPage({ first: 20, rows: 20 });
    await sleep(0);
    expect(host.calls.at(-1)).toMatchObject({ pageIndex: 1, pageSize: 20 });

    (el.querySelector('button.sort') as HTMLButtonElement).click();
    await sleep(0);
    expect(host.calls.at(-1)).toMatchObject({
      pageIndex: 0,
      sortBy: 'Title',
      sortDirection: 'asc',
    });
    (el.querySelector('button.sort') as HTMLButtonElement).click();
    await sleep(0);
    expect(host.calls.at(-1)).toMatchObject({ sortBy: 'Title', sortDirection: 'desc' });

    table.onSearch('  kvar ');
    table.onSearch('kvart');
    await sleep(400);
    expect(host.calls.at(-1)).toMatchObject({ searchText: 'kvart', pageIndex: 0 });
  });

  it('keeps the page, search and sort in the address', async () => {
    const { table } = await create();
    table.onPage({ first: 40, rows: 20 });
    await sleep(20);
    expect(TestBed.inject(Router).url).toContain('page=3');
  });

  it('goes back to the first page when the filters or the reload key change', async () => {
    const { fixture, host, table } = await create();
    table.onPage({ first: 20, rows: 20 });
    await sleep(0);
    const before = host.calls.length;

    host.filters.set({ 'status.equals': 'ONGOING' });
    fixture.detectChanges();
    await sleep(20);
    fixture.detectChanges();
    expect(host.calls.length).toBeGreaterThan(before);
    expect(host.calls.at(-1)).toMatchObject({
      pageIndex: 0,
      filters: { 'status.equals': 'ONGOING' },
    });

    const afterFilter = host.calls.length;
    host.reloadKey.set(1);
    fixture.detectChanges();
    await sleep(20);
    expect(host.calls.length).toBeGreaterThan(afterFilter);
  });

  it('shows the error as a toast and an empty table when loading fails', async () => {
    const notify = TestBed.inject(Notify);
    const spy = vi.spyOn(notify, 'error');
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.next = () => throwError(() => new ApiError(500, 'boom'));
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(spy).toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ma’lumot topilmadi');
  });
});

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { FilterBar, FilterField, FilterValues } from './filter-bar';

const fields: FilterField[] = [
  {
    key: 'status',
    label: 'Holat',
    type: 'select',
    options: [{ value: 'ONGOING', label: 'Savdo ketmoqda' }],
  },
  { key: 'title', label: 'Nomi', type: 'text' },
  { key: 'isActive', label: 'Faol', type: 'bool' },
  { key: 'createdAt', label: 'Sana', type: 'date-range' },
];

@Component({
  imports: [FilterBar],
  template: `<app-filter-bar [fields]="fields" (filtersChange)="emitted.push($event)" />`,
})
class Host {
  readonly fields = fields;
  readonly emitted: FilterValues[] = [];
}

interface BarApi {
  set(key: string, value: unknown): void;
  clear(): void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('FilterBar', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'list', component: Host }]), providePrimeNG({})],
    }),
  );

  async function create() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    fixture.detectChanges();
    const bar = fixture.debugElement.query(By.directive(FilterBar))
      .componentInstance as unknown as BarApi;
    return { fixture, host: fixture.componentInstance, bar };
  }

  it('starts with no filters and emits API-ready entries after a change', async () => {
    const { host, bar } = await create();
    expect(host.emitted.at(-1)).toEqual({});

    bar.set('status', 'ONGOING');
    bar.set('title', '  lot 5 ');
    bar.set('isActive', 'true');
    await sleep(350);

    expect(host.emitted.at(-1)).toEqual({
      'status.equals': 'ONGOING',
      'title.contains': 'lot 5',
      'isActive.equals': 'true',
    });
  });

  it('turns a date range into the UTC bounds of the Tashkent days (inclusive)', async () => {
    const { host, bar } = await create();
    bar.set('createdAt', [new Date(2026, 9, 1), new Date(2026, 9, 3)]);
    await sleep(350);

    // 1 Oct 00:00 Tashkent = 30 Sep 19:00 UTC; 3 Oct 23:59:59.999 Tashkent = 3 Oct 18:59:59.999 UTC. The API has only > and <.
    expect(host.emitted.at(-1)).toEqual({
      'createdAt.greaterthan': '2026-09-30T18:59:59.999Z',
      'createdAt.lessthan': '2026-10-03T19:00:00.000Z',
    });
  });

  it('keeps the filters in the address and clears them', async () => {
    const { fixture, host, bar } = await create();
    bar.set('status', 'ONGOING');
    await sleep(400);
    expect(TestBed.inject(Router).url).toContain('f.status=ONGOING');

    bar.clear();
    fixture.detectChanges();
    await sleep(50);
    expect(host.emitted.at(-1)).toEqual({});
    expect(TestBed.inject(Router).url).not.toContain('f.status');
  });

  it('restores the filters from the address', async () => {
    await TestBed.inject(Router).navigateByUrl(
      '/list?f.status=ONGOING&f.createdAt=2026-10-01..2026-10-03',
    );
    const { host } = await create();
    expect(host.emitted[0]).toMatchObject({
      'status.equals': 'ONGOING',
      'createdAt.greaterthan': '2026-09-30T18:59:59.999Z',
    });
  });
});

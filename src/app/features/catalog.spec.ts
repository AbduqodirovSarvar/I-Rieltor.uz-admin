import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { authInterceptor } from '../core/auth/auth.interceptor';
import { TokenStore } from '../core/auth/token-store';
import { Notify } from '../core/notify/notify.service';
import { Category, descendantIds, toTree } from './categories/category.service';
import { CategoryList } from './categories/category-list';
import { PropertyDetail } from './properties/property-detail';
import { PropertyForm } from './properties/property-form';

const minutes = (n: number) => new Date(Date.now() + n * 60_000).toISOString();
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const ok = (data: unknown) => ({
  success: true,
  statusCode: 200,
  message: null,
  errors: null,
  data,
});
const list = (items: unknown[]) => ({
  ...ok(items),
  pageIndex: 0,
  pageSize: 100,
  totalCount: items.length,
});

const cat = (id: string, name: string, parent: string | null = null, sortOrder = 0) =>
  ({ id, name, description: null, parentCategoryId: parent, sortOrder }) as Category;

function setup(routeParams: Record<string, string>, permissions: string[]) {
  localStorage.clear();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      providePrimeNG({}),
      MessageService,
      ConfirmationService,
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap(routeParams) } },
      },
    ],
  });
  TestBed.inject(TokenStore).set({
    accessToken: `x.${btoa(JSON.stringify({ permission: permissions }))}.y`,
    refreshToken: 'r',
    accessTokenExpiration: minutes(20),
    refreshTokenExpiration: minutes(60),
    userId: 'me',
  });
  return TestBed.inject(HttpTestingController);
}

describe('category tree', () => {
  const all = [
    cat('b', 'Yer', null, 2),
    cat('a', 'Uy-joy', null, 1),
    cat('a1', 'Kvartira', 'a', 1),
    cat('a2', 'Hovli', 'a', 2),
    cat('a11', 'Studiya', 'a1'),
    cat('x', 'Yetim', 'missing'),
  ];

  it('puts children under their parent in sort order, and keeps a category whose parent is missing', () => {
    expect(toTree(all).map((n) => `${n.depth}:${n.category.name}`)).toEqual([
      '0:Yetim',
      '0:Uy-joy',
      '1:Kvartira',
      '2:Studiya',
      '1:Hovli',
      '0:Yer',
    ]);
  });

  it('survives a cycle', () => {
    const cyclic = [cat('p', 'P', 'q'), cat('q', 'Q', 'p')];
    expect(toTree(cyclic).length).toBeLessThanOrEqual(2);
  });

  it('finds a category and everything below it', () => {
    expect([...descendantIds(all, 'a')].sort()).toEqual(['a', 'a1', 'a11', 'a2']);
  });
});

describe('CategoryList', () => {
  it('offers as parents everything except the category itself and its descendants', async () => {
    const backend = setup({}, ['READ_PROPERTYCATEGORY', 'UPDATE_PROPERTYCATEGORY']);
    const fixture = TestBed.createComponent(CategoryList);
    fixture.detectChanges();
    backend
      .expectOne((r) => r.url === '/api/PropertyCategory/list')
      .flush(list([cat('a', 'Uy-joy'), cat('a1', 'Kvartira', 'a'), cat('b', 'Yer')]));
    await fixture.whenStable();
    fixture.detectChanges();

    const page = fixture.componentInstance as unknown as {
      open(c?: Category, parent?: string | null): void;
      parentOptions(): { id: string | null; label: string }[];
      save(): void;
      form: { patchValue(v: Record<string, unknown>): void };
    };
    page.open(cat('a', 'Uy-joy'));
    expect(page.parentOptions().map((o) => o.id)).toEqual([null, 'b']);

    page.open(undefined, 'a');
    page.form.patchValue({ name: ' Garaj ', sortOrder: 4 });
    page.save();
    const request = backend.expectOne(
      (r) => r.method === 'POST' && r.url === '/api/PropertyCategory',
    );
    const form = request.request.body as FormData;
    expect(form.get('Name')).toBe('Garaj');
    expect(form.get('ParentCategoryId')).toBe('a');
    expect(form.get('SortOrder')).toBe('4');
    expect(form.has('Description')).toBe(false);
    request.flush(ok(cat('g', 'Garaj', 'a')));
    await tick();
    backend.expectOne((r) => r.url === '/api/PropertyCategory/list').flush(list([]));
  });

  it('shows the reason when the API refuses to delete', async () => {
    const backend = setup({}, ['READ_PROPERTYCATEGORY', 'DELETE_PROPERTYCATEGORY']);
    const fixture = TestBed.createComponent(CategoryList);
    fixture.detectChanges();
    backend
      .expectOne((r) => r.url === '/api/PropertyCategory/list')
      .flush(list([cat('a', 'Uy-joy')]));
    vi.spyOn(TestBed.inject(Notify), 'confirmDelete').mockResolvedValue(true);
    const error = vi.spyOn(TestBed.inject(Notify), 'error');
    await (fixture.componentInstance as unknown as { remove(c: Category): Promise<void> }).remove(
      cat('a', 'Uy-joy'),
    );
    backend
      .expectOne((r) => r.method === 'DELETE')
      .flush(
        { message: 'The category has subcategories' },
        { status: 409, statusText: 'Conflict' },
      );
    await tick();
    expect(error).toHaveBeenCalled();
  });
});

const property = {
  id: 'p1',
  title: 'Kvartira',
  description: 'Tavsif',
  categoryId: 'a',
  status: 'PUBLISHED',
  region: 'Toshkent',
  district: 'Chilonzor',
  address: 'Ko‘cha 1',
  latitude: 41.3,
  longitude: 69.2,
  cadastralNumber: '10:01:02',
  areaSqm: 64.5,
  landAreaSotix: null,
  rooms: 3,
  floor: 4,
  totalFloors: 9,
  buildYear: 2015,
  estimatedValue: 500000000,
  sellerName: null,
  viewCount: 7,
  createdAt: '2026-10-01T05:00:00Z',
  media: [] as unknown[],
};

describe('PropertyForm', () => {
  it('creates a property with the right multipart fields and skips empty ones', async () => {
    const backend = setup({}, ['CREATE_PROPERTY']);
    const fixture = TestBed.createComponent(PropertyForm);
    fixture.detectChanges();
    backend
      .expectOne((r) => r.url === '/api/PropertyCategory/list')
      .flush(list([cat('a', 'Uy-joy')]));
    await fixture.whenStable();

    const page = fixture.componentInstance as unknown as {
      save(): void;
      form: { patchValue(v: Record<string, unknown>): void };
    };
    page.save();
    backend.expectNone('/api/Property');

    page.form.patchValue({
      title: 'Uy',
      categoryId: 'a',
      region: 'Toshkent',
      address: 'Ko‘cha 1',
      areaSqm: 80.5,
      rooms: 0,
    });
    page.save();
    const request = backend.expectOne((r) => r.method === 'POST' && r.url === '/api/Property');
    const form = request.request.body as FormData;
    expect(form.get('Title')).toBe('Uy');
    expect(form.get('CategoryId')).toBe('a');
    expect(form.get('Status')).toBe('DRAFT');
    expect(form.get('AreaSqm')).toBe('80.5');
    expect(form.get('Rooms')).toBe('0'); // zero is a value, not "empty"
    expect(form.has('District')).toBe(false);
    expect(form.has('Latitude')).toBe(false);
    request.flush(ok({ ...property, id: 'new' }));
  });

  it('locks the status of a property that is in an auction', async () => {
    const backend = setup({ id: 'p1' }, ['UPDATE_PROPERTY']);
    const fixture = TestBed.createComponent(PropertyForm);
    fixture.detectChanges();
    backend
      .expectOne((r) => r.url === '/api/PropertyCategory/list')
      .flush(list([cat('a', 'Uy-joy')]));
    backend
      .expectOne((r) => r.url === '/api/Property')
      .flush(ok({ ...property, status: 'IN_AUCTION' }));
    await fixture.whenStable();
    fixture.detectChanges();

    const page = fixture.componentInstance as unknown as {
      form: { controls: { status: { disabled: boolean } } };
    };
    expect(page.form.controls.status.disabled).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('auksionda yoki sotilgan');
  });
});

describe('PropertyDetail media', () => {
  async function open(
    media: unknown[] = [],
    permissions = ['READ_PROPERTY', 'UPDATE_PROPERTY', 'DELETE_PROPERTY'],
  ) {
    const backend = setup({ id: 'p1' }, permissions);
    const fixture = TestBed.createComponent(PropertyDetail);
    fixture.detectChanges();
    backend.expectOne((r) => r.url === '/api/Property').flush(ok({ ...property, media }));
    backend
      .expectOne((r) => r.url === '/api/PropertyCategory/list')
      .flush(list([cat('a', 'Uy-joy')]));
    await fixture.whenStable();
    fixture.detectChanges();
    return {
      backend,
      fixture,
      el: fixture.nativeElement as HTMLElement,
      page: fixture.componentInstance as unknown as Record<string, (...args: unknown[]) => unknown>,
    };
  }

  const m = (id: string, sortOrder: number, isCover = false, kind = 'IMAGE') => ({
    id,
    kind,
    title: null,
    sortOrder,
    isCover,
    uploadedFile: { name: `${id}.png`, url: `/uploads/property/${id}.png` },
  });

  it('shows the details and the gallery with the cover marked', async () => {
    const { el } = await open([m('m1', 0, true), m('m2', 1, false, 'VIDEO')]);
    expect(el.textContent).toContain('Kvartira');
    expect(el.textContent).toContain('Uy-joy');
    expect(el.textContent).toContain('Muqova');
    expect(el.querySelectorAll('.gallery li').length).toBe(2);
  });

  it('uploads files one by one; the first picture of a property with no cover becomes the cover', async () => {
    const { backend, page } = await open([m('old', 4, false)]);
    (page['onPicked'] as (f: File[]) => void)([
      new File([new Uint8Array(5)], 'a.png'),
      new File([new Uint8Array(5)], 'b.png'),
    ]);
    page['upload']();

    const first = backend.expectOne((r) => r.method === 'POST' && r.url === '/api/Property/media');
    let form = first.request.body as FormData;
    expect(form.get('PropertyId')).toBe('p1');
    expect(form.get('Kind')).toBe('IMAGE');
    expect(form.get('SortOrder')).toBe('5');
    expect(form.get('IsCover')).toBe('true');
    first.flush(ok(m('n1', 5, true)));
    await tick();
    const second = backend.expectOne((r) => r.method === 'POST' && r.url === '/api/Property/media');
    form = second.request.body as FormData;
    expect(form.get('SortOrder')).toBe('6');
    expect(form.get('IsCover')).toBe('false');
    second.flush(ok(m('n2', 6)));
    await tick();
    backend.expectOne((r) => r.url === '/api/Property').flush(ok({ ...property, media: [] }));
    backend.expectOne((r) => r.url === '/api/PropertyCategory/list').flush(list([]));
  });

  it('a failed file is reported, the others are still uploaded', async () => {
    const { backend, page } = await open([]);
    const error = vi.spyOn(TestBed.inject(Notify), 'error');
    (page['onPicked'] as (f: File[]) => void)([
      new File([new Uint8Array(5)], 'bad.png'),
      new File([new Uint8Array(5)], 'good.png'),
    ]);
    page['upload']();
    backend
      .expectOne((r) => r.method === 'POST')
      .flush(
        { message: 'File content does not match' },
        { status: 400, statusText: 'Bad Request' },
      );
    await tick();
    backend.expectOne((r) => r.method === 'POST').flush(ok(m('g', 1)));
    await tick();
    expect(error).toHaveBeenCalled();
    backend.expectOne((r) => r.url === '/api/Property').flush(ok({ ...property, media: [] }));
    backend.expectOne((r) => r.url === '/api/PropertyCategory/list').flush(list([]));
  });

  it('makes another picture the cover, and archives the property with a full replacement', async () => {
    const { backend, page } = await open([m('m1', 0, true), m('m2', 1)]);
    page['makeCover'](m('m2', 1));
    const put = backend.expectOne((r) => r.method === 'PUT' && r.url === '/api/Property/media');
    const form = put.request.body as FormData;
    expect(form.get('Id')).toBe('m2');
    expect(form.get('IsCover')).toBe('true');
    put.flush(ok(m('m2', 1, true)));
    backend.expectOne((r) => r.url === '/api/Property').flush(ok({ ...property, media: [] }));
    backend.expectOne((r) => r.url === '/api/PropertyCategory/list').flush(list([]));

    vi.spyOn(TestBed.inject(Notify), 'confirm').mockResolvedValue(true);
    await (page['archive'] as () => Promise<void>)();
    const update = backend.expectOne((r) => r.method === 'PUT' && r.url === '/api/Property');
    const body = update.request.body as FormData;
    expect(body.get('Id')).toBe('p1');
    expect(body.get('Status')).toBe('ARCHIVED');
    expect(body.get('Title')).toBe('Kvartira');
    expect(body.get('CadastralNumber')).toBe('10:01:02');
    update.flush(ok({ ...property, status: 'ARCHIVED' }));
    await tick();
    backend
      .expectOne((r) => r.url === '/api/Property')
      .flush(ok({ ...property, status: 'ARCHIVED', media: [] }));
    backend.expectOne((r) => r.url === '/api/PropertyCategory/list').flush(list([]));
  });
});

import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { authInterceptor } from '../core/auth/auth.interceptor';
import { TokenStore } from '../core/auth/token-store';
import { fileUrl } from '../core/http/file-url';
import { Notify } from '../core/notify/notify.service';
import { CompanyPage } from './company/company-page';
import { SlideList } from './slides/slide-list';

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
  pageSize: 20,
  totalCount: items.length,
});

function setup(permissions: string[]) {
  localStorage.clear();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      providePrimeNG({}),
      MessageService,
      ConfirmationService,
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

describe('fileUrl', () => {
  it('keeps absolute addresses and prefixes relative ones with the API host', () => {
    expect(fileUrl('https://api.i-rieltor.uz/uploads/a.png')).toBe(
      'https://api.i-rieltor.uz/uploads/a.png',
    );
    expect(fileUrl('/uploads/a.png')).toBe('/uploads/a.png'); // development: same origin through the proxy
    expect(fileUrl(null)).toBe('');
  });
});

const slide = (id: string, order: number) => ({
  id,
  title: `Slayd ${id}`,
  subtitle: '',
  content: '',
  order,
  durationMs: 3000,
  uploadedFile: { url: `/uploads/slide/${id}.png`, alt: null },
});

describe('SlideList', () => {
  it('lists slides with their pictures and creates one with a file', async () => {
    const backend = setup(['READ_SLIDE', 'CREATE_SLIDE', 'UPDATE_SLIDE', 'DELETE_SLIDE']);
    const fixture = TestBed.createComponent(SlideList);
    fixture.detectChanges();
    await fixture.whenStable();
    backend
      .expectOne((r) => r.url === '/api/Slide/list')
      .flush(list([slide('a', 1), slide('b', 2)]));
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Slayd a');
    expect(el.querySelectorAll('img.thumb').length).toBe(2);

    const page = fixture.componentInstance as unknown as {
      open(): void;
      save(): void;
      picked(files: File[]): void;
      fileError(): boolean;
      form: { patchValue(v: Record<string, unknown>): void };
    };
    page.open();
    page.form.patchValue({ title: 'Yangi', order: 3 });
    page.save();
    expect(page.fileError()).toBe(true);
    backend.expectNone('/api/Slide');

    page.picked([new File([new Uint8Array(10)], 'a.png')]);
    page.save();
    const request = backend.expectOne((r) => r.method === 'POST' && r.url === '/api/Slide');
    const form = request.request.body as FormData;
    expect(form.get('Title')).toBe('Yangi');
    expect(form.get('Order')).toBe('3');
    expect(form.get('DurationMs')).toBe('3000');
    expect((form.get('File') as File).name).toBe('a.png');
    request.flush(ok(slide('c', 3)));
    await tick();
    backend.expectOne((r) => r.url === '/api/Slide/list').flush(list([slide('a', 1)]));
  });

  it('moves a slide by swapping the order numbers with its neighbour', async () => {
    const backend = setup(['READ_SLIDE', 'UPDATE_SLIDE']);
    const fixture = TestBed.createComponent(SlideList);
    fixture.detectChanges();
    await fixture.whenStable();
    backend
      .expectOne((r) => r.url === '/api/Slide/list')
      .flush(list([slide('a', 1), slide('b', 2)]));
    await fixture.whenStable();

    const page = fixture.componentInstance as unknown as {
      move(s: unknown, d: -1 | 1): void;
      canMove(s: unknown, d: -1 | 1): boolean;
    };
    expect(page.canMove(slide('a', 1), -1)).toBe(false);
    expect(page.canMove(slide('a', 1), 1)).toBe(true);
    page.move(slide('a', 1), 1);

    const puts = backend.match((r) => r.method === 'PUT' && r.url === '/api/Slide');
    expect(puts.length).toBe(2);
    const byId = Object.fromEntries(
      puts.map((p) => [
        (p.request.body as FormData).get('Id'),
        (p.request.body as FormData).get('Order'),
      ]),
    );
    expect(byId).toEqual({ a: '2', b: '1' });
    puts.forEach((p) => p.flush(ok({})));
    await tick();
    backend.expectOne((r) => r.url === '/api/Slide/list').flush(list([]));
  });

  it('asks before deleting', async () => {
    const backend = setup(['READ_SLIDE', 'DELETE_SLIDE']);
    const fixture = TestBed.createComponent(SlideList);
    fixture.detectChanges();
    await fixture.whenStable();
    backend.expectOne((r) => r.url === '/api/Slide/list').flush(list([slide('a', 1)]));
    const spy = vi.spyOn(TestBed.inject(Notify), 'confirmDelete').mockResolvedValue(false);
    await (fixture.componentInstance as unknown as { remove(s: unknown): Promise<void> }).remove(
      slide('a', 1),
    );
    expect(spy).toHaveBeenCalled();
    backend.expectNone((r) => r.method === 'DELETE');
  });
});

describe('CompanyPage', () => {
  const company = {
    id: 'c1',
    name: 'I-Rieltor',
    description: 'Tavsif',
    mission: null,
    address: 'Toshkent',
    location: 'https://maps.example/x',
    phoneNumber: '+998901234567',
    phoneNumber2: null,
    email: null,
    latitude: 41.3,
    longitude: 69.2,
    logoFile: { url: '/uploads/company/logo.png' },
  };

  it('shows the saved company and sends a full replacement without the logo when it is not changed', async () => {
    const backend = setup(['READ_COMPANY', 'UPDATE_COMPANY']);
    const fixture = TestBed.createComponent(CompanyPage);
    fixture.detectChanges();
    backend.expectOne((r) => r.url === '/api/Company/list').flush(list([company]));
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector<HTMLInputElement>('#cName')?.value).toBe('I-Rieltor');
    expect(el.querySelector('img.current')).toBeTruthy();

    const page = fixture.componentInstance as unknown as {
      save(): void;
      form: { patchValue(v: Record<string, unknown>): void };
    };
    page.form.patchValue({ address: 'Samarqand' });
    page.save();
    const request = backend.expectOne((r) => r.method === 'PUT' && r.url === '/api/Company');
    const form = request.request.body as FormData;
    expect(form.get('Id')).toBe('c1');
    expect(form.get('Address')).toBe('Samarqand');
    expect(form.get('PhoneNumber')).toBe('+998901234567');
    expect(form.get('Latitude')).toBe('41.3');
    expect(form.has('Logo')).toBe(false);
    expect(form.has('Mission')).toBe(false);
    request.flush(ok({ ...company, address: 'Samarqand' }));
  });

  it('on the first visit offers to create the company and validates the phone and the link', async () => {
    const backend = setup(['READ_COMPANY', 'CREATE_COMPANY']);
    const fixture = TestBed.createComponent(CompanyPage);
    fixture.detectChanges();
    backend.expectOne((r) => r.url === '/api/Company/list').flush(list([]));
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('hali kiritilmagan');

    const page = fixture.componentInstance as unknown as {
      save(): void;
      form: { patchValue(v: Record<string, unknown>): void };
    };
    page.form.patchValue({
      name: 'X',
      description: 'Y',
      address: 'Z',
      location: 'not a link',
      phoneNumber: '12345',
    });
    page.save();
    backend.expectNone('/api/Company');

    page.form.patchValue({ location: 'https://maps.example/x', phoneNumber: '+998901234567' });
    page.save();
    const request = backend.expectOne((r) => r.method === 'POST' && r.url === '/api/Company');
    expect((request.request.body as FormData).get('Name')).toBe('X');
    request.flush(ok(company));
  });
});

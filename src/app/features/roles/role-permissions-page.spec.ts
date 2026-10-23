import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { authInterceptor } from '../../core/auth/auth.interceptor';
import { TokenStore } from '../../core/auth/token-store';
import { RolePermissionsPage } from './role-permissions-page';

const minutes = (n: number) => new Date(Date.now() + n * 60_000).toISOString();
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const ok = (data: unknown) => ({
  success: true,
  statusCode: 200,
  message: null,
  errors: null,
  data,
});

const names = [
  'CREATE_USER',
  'READ_USER',
  'UPDATE_USER',
  'DELETE_USER',
  'READ_DASHBOARD',
  'ASSIGN_USERROLE',
  'READ_USERROLE',
];

interface PageApi {
  toggle(name: string): void;
  toggleRow(row: unknown): void;
  rows(): { entity: string; main: (string | null)[]; other: { name: string }[] }[];
  save(): void;
  dirty(): boolean;
  added(): string[];
  removed(): string[];
}

describe('RolePermissionsPage', () => {
  let backend: HttpTestingController;

  async function open() {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        providePrimeNG({}),
        MessageService,
        ConfirmationService,
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'r1' }) } },
        },
      ],
    });
    TestBed.inject(TokenStore).set({
      accessToken: `x.${btoa(JSON.stringify({ permission: ['READ_USERROLEPERMISSION', 'CREATE_USERROLEPERMISSION', 'DELETE_USERROLEPERMISSION'] }))}.y`,
      refreshToken: 'r',
      accessTokenExpiration: minutes(20),
      refreshTokenExpiration: minutes(60),
      userId: 'me',
    });
    backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(RolePermissionsPage);
    fixture.detectChanges();
    backend.expectOne('/api/UserRolePermission/all-permissions').flush(names);
    backend
      .expectOne(
        (r) =>
          r.url === '/api/UserRolePermission/list' &&
          r.params.get('Filters[userRoleId.equals]') === 'r1',
      )
      .flush({
        ...ok([
          { id: 'p1', userRoleId: 'r1', permission: 'READ_USER' },
          { id: 'p2', userRoleId: 'r1', permission: 'READ_DASHBOARD' },
        ]),
        pageIndex: 0,
        pageSize: 100,
        totalCount: 2,
      });
    backend.expectOne((r) => r.url === '/api/UserRole').flush(ok({ id: 'r1', name: 'MANAGER' }));
    await fixture.whenStable();
    fixture.detectChanges();
    return {
      fixture,
      el: fixture.nativeElement as HTMLElement,
      page: fixture.componentInstance as unknown as PageApi,
    };
  }

  afterEach(() => backend.verify());

  it('groups the permissions by section and action and ticks what the role has', async () => {
    const { el, page } = await open();
    const rows = page.rows();
    expect(rows.map((r) => r.entity)).toEqual(
      expect.arrayContaining(['USER', 'DASHBOARD', 'USERROLE']),
    );
    const user = rows.find((r) => r.entity === 'USER')!;
    expect(user.main).toEqual(['CREATE_USER', 'READ_USER', 'UPDATE_USER', 'DELETE_USER']);
    expect(rows.find((r) => r.entity === 'USERROLE')!.other.map((o) => o.name)).toEqual([
      'ASSIGN_USERROLE',
    ]);
    expect(el.textContent).toContain('MANAGER roli ruxsatlari');
    expect(el.textContent).toContain('Foydalanuvchilar');
    expect(page.dirty()).toBe(false);
    expect(el.querySelectorAll('input[type=checkbox]:checked').length).toBeGreaterThanOrEqual(2);
  });

  it('saves the difference: creates the new permissions and deletes the removed ones', async () => {
    const { page } = await open();
    page.toggle('CREATE_USER');
    page.toggle('READ_DASHBOARD');
    expect(page.added()).toEqual(['CREATE_USER']);
    expect(page.removed()).toEqual(['READ_DASHBOARD']);

    page.save();
    const create = backend.expectOne(
      (r) => r.method === 'POST' && r.url === '/api/UserRolePermission',
    );
    const form = create.request.body as FormData;
    expect(form.get('UserRoleId')).toBe('r1');
    expect(form.get('Permission')).toBe('CREATE_USER');
    create.flush(ok({ id: 'p3', userRoleId: 'r1', permission: 'CREATE_USER' }));
    await tick();
    const remove = backend.expectOne((r) => r.method === 'DELETE');
    expect(remove.request.body).toEqual({ id: 'p2' });
    remove.flush(ok(true));
    await tick();

    // After saving the page reloads what the server now has.
    backend.expectOne('/api/UserRolePermission/all-permissions').flush(names);
    backend
      .expectOne((r) => r.url === '/api/UserRolePermission/list')
      .flush({
        ...ok([
          { id: 'p1', userRoleId: 'r1', permission: 'READ_USER' },
          { id: 'p3', userRoleId: 'r1', permission: 'CREATE_USER' },
        ]),
        pageIndex: 0,
        pageSize: 100,
        totalCount: 2,
      });
    backend.expectOne((r) => r.url === '/api/UserRole').flush(ok({ id: 'r1', name: 'MANAGER' }));
    await tick();
    expect(page.dirty()).toBe(false);
  });

  it('a whole row is switched on or off at once', async () => {
    const { page } = await open();
    const user = page.rows().find((r) => r.entity === 'USER');
    page.toggleRow(user);
    expect(page.added().sort()).toEqual(['CREATE_USER', 'DELETE_USER', 'UPDATE_USER']);
    page.toggleRow(user);
    expect(page.removed().sort()).toEqual(['READ_USER']);
  });
});

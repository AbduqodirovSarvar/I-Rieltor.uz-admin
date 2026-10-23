import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { authInterceptor } from '../../core/auth/auth.interceptor';
import { TokenStore } from '../../core/auth/token-store';
import { Notify } from '../../core/notify/notify.service';
import { RoleList } from '../roles/role-list';
import { UserDetail } from './user-detail';
import { UserForm } from './user-form';

const minutes = (n: number) => new Date(Date.now() + n * 60_000).toISOString();
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const ok = (data: unknown) => ({
  success: true,
  statusCode: 200,
  message: null,
  errors: null,
  data,
});

const user = {
  id: 'u2',
  type: 'INDIVIDUAL',
  fullName: 'Ali Valiyev',
  login: 'ali',
  legalName: null,
  innpinfl: '12345678901234',
  phone: '+998901234567',
  secondaryPhone: null,
  address: 'Toshkent',
  email: 'ali@example.com',
  emailConfirmedAt: null,
  userRoleId: 'r1',
  userRole: { id: 'r1', name: 'MANAGER' },
  createdAt: '2026-10-01T05:00:00Z',
};

function setup(routeParams: Record<string, string>, permissions: string[], me = 'me') {
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
    accessToken: `x.${btoa(JSON.stringify({ 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': me, permission: permissions }))}.y`,
    refreshToken: 'r',
    accessTokenExpiration: minutes(20),
    refreshTokenExpiration: minutes(60),
    userId: me,
  });
  return TestBed.inject(HttpTestingController);
}

interface FormApi {
  form: {
    patchValue(value: Record<string, string>): void;
    controls: Record<string, { setValue(v: string): void; markAsDirty(): void }>;
    invalid: boolean;
  };
  save(): void;
}

describe('UserForm', () => {
  it('on edit sends only what changed and names a cleared optional field in ClearFields', async () => {
    const backend = setup({ id: 'u2' }, ['UPDATE_USER']);
    const fixture = TestBed.createComponent(UserForm);
    fixture.detectChanges();
    backend.expectOne((r) => r.url === '/api/User' && r.params.get('Id') === 'u2').flush(ok(user));
    await tick();
    const page = fixture.componentInstance as unknown as FormApi;

    page.form.controls['phone'].setValue('+998909999999');
    page.form.controls['address'].setValue('');
    page.form.controls['password'].setValue('New1!pass');
    page.save();

    const request = backend.expectOne((r) => r.url === '/api/User' && r.method === 'PUT');
    const body = request.request.body as FormData;
    expect(body.get('Id')).toBe('u2');
    expect(body.get('Phone')).toBe('+998909999999');
    expect(body.get('Password')).toBe('New1!pass');
    expect(body.getAll('ClearFields')).toEqual(['Address']);
    expect(body.has('Login')).toBe(false);
    expect(body.has('Email')).toBe(false);
    request.flush(ok({ ...user, phone: '+998909999999' }));
    backend.verify();
  });

  it('on edit does not call the server when nothing changed', async () => {
    const backend = setup({ id: 'u2' }, ['UPDATE_USER']);
    const fixture = TestBed.createComponent(UserForm);
    fixture.detectChanges();
    backend.expectOne((r) => r.url === '/api/User').flush(ok(user));
    await tick();
    (fixture.componentInstance as unknown as FormApi).save();
    backend.verify();
  });

  it('on create needs the required fields, then posts the multipart form', async () => {
    const backend = setup({}, ['CREATE_USER']);
    const fixture = TestBed.createComponent(UserForm);
    fixture.detectChanges();
    const page = fixture.componentInstance as unknown as FormApi;

    page.save();
    backend.expectNone('/api/User');

    page.form.patchValue({
      lastName: 'Valiyev',
      firstName: 'Ali',
      email: 'ali@example.com',
      password: 'Strong1!pass',
      phone: '+998901234567',
    });
    page.save();
    const request = backend.expectOne('/api/User');
    const body = request.request.body as FormData;
    expect(request.request.method).toBe('POST');
    expect(body.get('LastName')).toBe('Valiyev');
    expect(body.get('Email')).toBe('ali@example.com');
    expect(body.get('Phone')).toBe('+998901234567');
    expect(body.has('MiddleName')).toBe(false);
    request.flush(ok(user));
  });

  it('puts a field error of the server on the field', async () => {
    const backend = setup({}, ['CREATE_USER']);
    const fixture = TestBed.createComponent(UserForm);
    fixture.detectChanges();
    const page = fixture.componentInstance as unknown as FormApi;
    page.form.patchValue({
      lastName: 'V',
      firstName: 'A',
      email: 'a@b.co',
      password: 'Strong1!pass',
    });
    page.save();
    backend
      .expectOne('/api/User')
      .flush(
        { message: 'Invalid', errors: ['Email: already used'] },
        { status: 400, statusText: 'Bad Request' },
      );
    await tick();
    expect((page.form.controls['email'] as unknown as { errors: unknown }).errors).toEqual({
      server: ['already used'],
    });
  });
});

describe('UserDetail', () => {
  async function open(permissions: string[], me = 'me') {
    const backend = setup({ id: 'u2' }, permissions, me);
    const fixture = TestBed.createComponent(UserDetail);
    fixture.detectChanges();
    backend.expectOne((r) => r.url === '/api/User').flush(ok(user));
    await fixture.whenStable();
    fixture.detectChanges();
    return { backend, fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the user and the buttons the permissions allow', async () => {
    const { el } = await open(['READ_USER', 'UPDATE_USER']);
    expect(el.textContent).toContain('Ali Valiyev');
    expect(el.textContent).toContain('+998 90 123 45 67');
    expect(el.textContent).toContain('Email tasdiqlanmagan');
    expect(el.textContent).toContain('Tahrirlash');
    expect(el.textContent).not.toContain('O‘chirish');
    expect(el.textContent).not.toContain('Rol tayinlash');
  });

  it('deletes after a confirmation, sending the id in the body', async () => {
    const { backend, fixture } = await open(['READ_USER', 'DELETE_USER']);
    vi.spyOn(TestBed.inject(Notify), 'confirmDelete').mockResolvedValue(true);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await (fixture.componentInstance as unknown as { remove(): Promise<void> }).remove();
    const request = backend.expectOne((r) => r.method === 'DELETE');
    expect(request.request.body).toEqual({ id: 'u2' });
    request.flush(ok(true));
    expect(navigate).toHaveBeenCalledWith(['/users']);
  });

  it('when the server refuses the delete (403) it stays on the page and tells why', async () => {
    const { backend, fixture } = await open(['READ_USER', 'DELETE_USER']);
    vi.spyOn(TestBed.inject(Notify), 'confirmDelete').mockResolvedValue(true);
    const toast = vi.spyOn(TestBed.inject(MessageService), 'add');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const done = (fixture.componentInstance as unknown as { remove(): Promise<void> }).remove();
    await tick();
    backend
      .expectOne((r) => r.method === 'DELETE')
      .flush(
        { success: false, statusCode: 403, message: 'Forbidden' },
        { status: 403, statusText: 'Forbidden' },
      );
    await done;
    expect(navigate).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Bu amal uchun ruxsatingiz yo‘q' }),
    );
  });

  it('assigns a role', async () => {
    const { backend, fixture } = await open(['READ_USER', 'ASSIGN_USERROLE']);
    const page = fixture.componentInstance as unknown as {
      openRoleDialog(): void;
      saveRole(): void;
      selectedRole: string | null;
    };
    page.openRoleDialog();
    backend
      .expectOne((r) => r.url === '/api/UserRole/list')
      .flush({ ...ok([{ id: 'r2', name: 'ADMIN' }]), totalCount: 1 });
    page.selectedRole = 'r2';
    page.saveRole();
    const request = backend.expectOne('/api/User/role');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ userId: 'u2', userRoleId: 'r2' });
    request.flush(ok({ ...user, userRoleId: 'r2', userRole: { id: 'r2', name: 'ADMIN' } }));
    await tick();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('ADMIN');
  });

  it('does not offer to delete your own account', async () => {
    const { el } = await open(['READ_USER', 'DELETE_USER'], 'u2');
    expect(el.textContent).not.toContain('O‘chirish');
    expect(el.textContent).toContain('Bu sizning akkauntingiz');
  });
});

describe('RoleList', () => {
  it('creates a role from the dialog as a multipart form and reloads the list', async () => {
    const backend = setup({}, ['READ_USERROLE', 'CREATE_USERROLE']);
    const fixture = TestBed.createComponent(RoleList);
    fixture.detectChanges();
    await fixture.whenStable();
    backend.expectOne((r) => r.url === '/api/UserRole/list').flush({ ...ok([]), totalCount: 0 });

    const page = fixture.componentInstance as unknown as {
      open(): void;
      save(): void;
      form: { patchValue(v: Record<string, string>): void };
    };
    page.open();
    page.save();
    backend.expectNone('/api/UserRole');

    page.form.patchValue({ name: ' EDITOR ', description: 'Kontent' });
    page.save();
    const request = backend.expectOne('/api/UserRole');
    const body = request.request.body as FormData;
    expect(body.get('Name')).toBe('EDITOR');
    expect(body.get('Description')).toBe('Kontent');
    request.flush(ok({ id: 'r9', name: 'EDITOR' }));
    await tick();
    backend.expectOne((r) => r.url === '/api/UserRole/list').flush({ ...ok([]), totalCount: 0 });
  });
});

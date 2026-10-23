import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ApiError } from './http/api-error';
import { GlobalErrorHandler } from './notify/global-error-handler';
import { Notify } from './notify/notify.service';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|html)$/.test(name) && !name.endsWith('.spec.ts') && !name.endsWith('schema.d.ts')
      ? [path]
      : [];
  });
}

describe('security rules for the source', () => {
  const files = sources(join(process.cwd(), 'src'));

  it('never renders raw HTML or turns off Angular sanitization', () => {
    const offenders = files.filter((f) =>
      /\[innerHTML\]|\.innerHTML\s*=|bypassSecurityTrust|outerHTML\s*=|document\.write|\beval\(/.test(
        readFileSync(f, 'utf8'),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('does not write tokens or the session to the console', () => {
    const offenders = files.filter((f) =>
      /console\.\w+\([^)]*(accessToken|refreshToken|session)/i.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('keeps tokens only in the one session key', () => {
    const users = files.filter((f) => /localStorage\.(set|get)Item/.test(readFileSync(f, 'utf8')));
    // token-store owns the session; the theme and the table preferences are harmless conveniences.
    for (const f of users) {
      const text = readFileSync(f, 'utf8');
      if (/Token/i.test(text.match(/localStorage\.\w+Item\([^)]*\)/g)?.join(' ') ?? '')) {
        expect(f).toContain('token-store');
      }
    }
  });
});

describe('GlobalErrorHandler', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MessageService,
        ConfirmationService,
        { provide: ErrorHandler, useClass: GlobalErrorHandler },
      ],
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('shows an unhandled error as a toast with the request id for server errors', () => {
    const toast = vi.spyOn(TestBed.inject(MessageService), 'add');
    TestBed.inject(ErrorHandler).handleError(new ApiError(500, 'boom', [], null, 'req-42'));
    expect(JSON.stringify(toast.mock.calls[0][0])).toContain('req-42');
  });

  it('stays quiet about a 401 (the sign-in redirect handles it)', () => {
    const toast = vi.spyOn(TestBed.inject(MessageService), 'add');
    TestBed.inject(ErrorHandler).handleError(new ApiError(401, 'Unauthorized'));
    expect(toast).not.toHaveBeenCalled();
    expect(TestBed.inject(Notify)).toBeTruthy();
  });
});

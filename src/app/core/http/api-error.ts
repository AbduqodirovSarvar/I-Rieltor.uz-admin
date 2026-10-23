import { HttpErrorResponse } from '@angular/common/http';
import { ResponseModel } from './response-model';

/** A failed API call in one shape: the status, a readable message and the field errors the backend listed. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** "Field: message" lines of a 400, empty otherwise. */
    readonly errors: string[] = [],
    /** Seconds to wait before retrying (429). */
    readonly retryAfter: number | null = null,
    /** X-Request-ID of the call; the backend log is searched by it. */
    readonly requestId: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
  get isForbidden(): boolean {
    return this.status === 403;
  }
  get isNotFound(): boolean {
    return this.status === 404;
  }
  get isConflict(): boolean {
    return this.status === 409;
  }
  get isValidation(): boolean {
    return this.status === 400;
  }
  get isNetwork(): boolean {
    return this.status === 0;
  }

  /** Field name → messages, from `"Name: message"` lines (the part before the first colon is the field). */
  fieldErrors(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const line of this.errors) {
      const colon = line.indexOf(':');
      if (colon <= 0) continue;
      const field = line.slice(0, colon).trim();
      (result[field] ??= []).push(line.slice(colon + 1).trim());
    }
    return result;
  }

  static from(error: unknown): ApiError {
    if (error instanceof ApiError) return error;
    if (!(error instanceof HttpErrorResponse)) {
      return new ApiError(-1, error instanceof Error ? error.message : 'Noma’lum xato');
    }
    const body = (error.error ?? {}) as Partial<ResponseModel<unknown>>;
    const requestId = error.headers?.get('X-Request-ID') ?? null;
    const retryHeader = error.headers?.get('Retry-After');
    const retryAfter = retryHeader && /^\d+$/.test(retryHeader) ? Number(retryHeader) : null;
    const message =
      error.status === 0
        ? 'Serverga ulanib bo‘lmadi'
        : body.message || error.statusText || 'Xatolik';
    return new ApiError(error.status, message, body.errors ?? [], retryAfter, requestId);
  }
}

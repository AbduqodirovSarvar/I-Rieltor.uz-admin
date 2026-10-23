import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ApiError } from '../http/api-error';
import { Notify } from './notify.service';

/**
 * The last net: an error nobody handled is logged and shown as a toast (an API error with its request id), instead of
 * vanishing into the console.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly notify = inject(Notify);

  handleError(error: unknown): void {
    console.error(error);
    // A 401 that ended the session is handled by the sign-in redirect; showing it as well would only add noise.
    if (error instanceof ApiError && error.isUnauthorized) return;
    this.notify.error(error);
  }
}

import { Injectable, inject } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ApiError } from '../http/api-error';
import { I18n } from '../i18n/i18n.service';

export interface ConfirmOptions {
  message: string;
  header?: string;
  /** Red confirm button (delete, cancel an auction...). */
  danger?: boolean;
  acceptLabel?: string;
  rejectLabel?: string;
}

/** Toasts and confirmation dialogs; the containers (`p-toast`, `p-confirmdialog`) are in the root component. */
@Injectable({ providedIn: 'root' })
export class Notify {
  private readonly messages = inject(MessageService);
  private readonly confirmations = inject(ConfirmationService);
  private readonly i18n = inject(I18n);

  success(message: string): void {
    this.messages.add({ severity: 'success', summary: message, life: 3500 });
  }

  info(message: string): void {
    this.messages.add({ severity: 'info', summary: message, life: 4000 });
  }

  /**
   * Shows what went wrong in words the user understands. The request id (X-Request-ID) is included for server errors,
   * so a report can be matched with the backend log.
   */
  error(error: unknown, fallback?: string): void {
    const apiError = ApiError.from(error);
    const { summary, detail } = this.describe(apiError, fallback);
    this.messages.add({
      severity: 'error',
      summary,
      detail,
      life: apiError.status >= 500 || apiError.status < 0 ? 10000 : 6000,
    });
  }

  describe(error: ApiError, fallback?: string): { summary: string; detail?: string } {
    const t = (key: Parameters<I18n['t']>[0], params?: Record<string, string | number>) =>
      this.i18n.t(key, params);
    const requestId = error.requestId ? t('common.requestId', { id: error.requestId }) : undefined;
    switch (true) {
      case error.isNetwork:
        return { summary: t('common.networkError') };
      case error.status === 429:
        return {
          summary: error.message,
          detail: error.retryAfter
            ? t('common.retryAfter', { seconds: error.retryAfter })
            : undefined,
        };
      case error.isForbidden:
        return { summary: t('errors.forbidden'), detail: requestId };
      case error.isNotFound:
        return { summary: fallback ?? t('errors.notFound'), detail: requestId };
      case error.isConflict:
        return { summary: error.message || t('errors.conflict'), detail: requestId };
      case error.isValidation:
        return { summary: error.message, detail: error.errors.join('\n') || requestId };
      case error.status >= 500:
        return { summary: t('errors.server'), detail: requestId };
      default:
        return { summary: error.message || fallback || t('common.errorTitle'), detail: requestId };
    }
  }

  /** Resolves to true when the user confirms. */
  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmations.confirm({
        header: options.header ?? this.i18n.t('common.confirm'),
        message: options.message,
        icon: options.danger ? 'pi pi-exclamation-triangle' : 'pi pi-question-circle',
        acceptLabel: options.acceptLabel ?? this.i18n.t('common.yes'),
        rejectLabel: options.rejectLabel ?? this.i18n.t('common.cancel'),
        acceptButtonStyleClass: options.danger ? 'p-button-danger' : undefined,
        rejectButtonStyleClass: 'p-button-text',
        accept: () => resolve(true),
        reject: () => resolve(false),
      });
    });
  }

  /** The usual "are you sure you want to delete" question. */
  confirmDelete(what?: string): Promise<boolean> {
    return this.confirm({
      message: what
        ? `${what}\n${this.i18n.t('common.confirmDelete')}`
        : this.i18n.t('common.confirmDelete'),
      danger: true,
      acceptLabel: this.i18n.t('common.delete'),
    });
  }
}

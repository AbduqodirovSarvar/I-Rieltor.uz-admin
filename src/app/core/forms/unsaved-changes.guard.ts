import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { I18n } from '../i18n/i18n.service';
import { Notify } from '../notify/notify.service';

/** A page with a form implements this; the guard then asks before the user leaves with unsaved changes. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (!component.hasUnsavedChanges()) return true;
  const i18n = inject(I18n);
  return inject(Notify).confirm({
    message: i18n.t('common.unsaved'),
    danger: true,
    acceptLabel: i18n.t('common.close'),
    rejectLabel: i18n.t('common.cancel'),
  });
};

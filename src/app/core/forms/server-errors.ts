import { AbstractControl, FormGroup } from '@angular/forms';
import { take } from 'rxjs';
import { ApiError } from '../http/api-error';

/**
 * Puts the backend's field errors ("Title: is required") on the matching controls (names are matched ignoring case, so the
 * API's `Title` finds the form's `title`). The error disappears when the user edits the field. Returns the messages that
 * belong to no control, for a toast.
 */
export function applyServerErrors(
  form: FormGroup,
  error: ApiError,
  aliases: Record<string, string> = {},
): string[] {
  const unmatched: string[] = [];
  const byName = new Map<string, AbstractControl>(
    Object.entries(form.controls).map(([name, control]) => [name.toLowerCase(), control]),
  );
  const fieldErrors = error.fieldErrors();

  for (const [field, messages] of Object.entries(fieldErrors)) {
    const key = (aliases[field] ?? field).toLowerCase();
    const control = byName.get(key);
    if (!control) {
      unmatched.push(...messages.map((m) => `${field}: ${m}`));
      continue;
    }
    control.setErrors({ ...(control.errors ?? {}), server: messages });
    control.markAsTouched();
    control.valueChanges.pipe(take(1)).subscribe(() => {
      const rest = { ...control.errors };
      delete rest['server'];
      control.setErrors(Object.keys(rest).length ? rest : null);
    });
  }

  // A 400 without field lines (a rule broken by the whole form) is just its message.
  if (Object.keys(fieldErrors).length === 0 && error.message) unmatched.push(error.message);
  return unmatched;
}

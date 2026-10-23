import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const empty = (value: unknown) => value === null || value === undefined || value === '';

/** E.164 as the backend wants it: `+` and 10–14 digits. */
export const phoneValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  empty(control.value) || /^\+\d{10,14}$/.test(String(control.value)) ? null : { phone: true };

/** The backend's password rule: 8+ characters with an uppercase letter, a digit and a symbol. */
export const passwordValidator: ValidatorFn = (control) => {
  const value = String(control.value ?? '');
  if (empty(control.value)) return null;
  return value.length >= 8 && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value)
    ? null
    : { password: true };
};

/** PINFL: exactly 14 digits. */
export const pinflValidator: ValidatorFn = (control) =>
  empty(control.value) || /^\d{14}$/.test(String(control.value)) ? null : { pinfl: true };

/** STIR (INN): exactly 9 digits. */
export const innValidator: ValidatorFn = (control) =>
  empty(control.value) || /^\d{9}$/.test(String(control.value)) ? null : { inn: true };

export const urlValidator: ValidatorFn = (control) => {
  if (empty(control.value)) return null;
  try {
    const url = new URL(String(control.value));
    return url.protocol === 'http:' || url.protocol === 'https:' ? null : { url: true };
  } catch {
    return { url: true };
  }
};

/** The two controls must hold the same value (password and its repeat). Put it on the group; the error lands on `other`. */
export function matchesValidator(name: string, other: string): ValidatorFn {
  return (group) => {
    const first = group.get(name);
    const second = group.get(other);
    if (!first || !second) return null;
    const mismatch = first.value !== second.value;
    const errors = second.errors ?? {};
    if (mismatch) second.setErrors({ ...errors, mismatch: true });
    else if (errors['mismatch']) {
      const rest = { ...errors };
      delete rest['mismatch'];
      second.setErrors(Object.keys(rest).length ? rest : null);
    }
    return null;
  };
}

import { Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { map, scan, startWith, switchMap } from 'rxjs';
import { I18n, TextKey } from '../../../core/i18n/i18n.service';

/**
 * A label, the control (projected), a hint and the error messages of the control:
 * `<app-form-field label="Nomi" [control]="form.controls.title" required><input pInputText formControlName="title" /></app-form-field>`.
 * Errors show once the control was touched or edited. Messages from the server (`applyServerErrors`) are shown as they came.
 */
@Component({
  selector: 'app-form-field',
  templateUrl: './form-field.html',
  styleUrl: './form-field.scss',
})
export class FormField {
  readonly label = input.required<string>();
  readonly control = input.required<AbstractControl>();
  readonly required = input(false);
  readonly hint = input<string | null>(null);
  /** The `id` of the control inside, so the label points at it. */
  readonly forId = input<string | null>(null);

  private readonly i18n = inject(I18n);

  /** Ticks on every event of the control (value, status, touched...), so the messages follow it. */
  private readonly ticks = toSignal(
    toObservable(this.control).pipe(
      switchMap((control) => control.events.pipe(startWith(null))),
      scan((count) => count + 1, 0),
      map((count) => count),
    ),
    { initialValue: 0 },
  );

  protected readonly messages = computed<string[]>(() => {
    this.ticks();
    const control = this.control();
    if (!control.errors || !(control.touched || control.dirty)) return [];
    return Object.entries(control.errors).flatMap(([name, detail]) => this.message(name, detail));
  });

  private message(name: string, detail: unknown): string[] {
    if (name === 'server') return detail as string[];
    const params = (typeof detail === 'object' && detail !== null ? detail : {}) as Record<
      string,
      string | number
    >;
    const key = `validation.${name}` as TextKey;
    const text = this.i18n.t(key, params);
    return [text === key ? this.i18n.t('validation.invalid') : text];
  }
}

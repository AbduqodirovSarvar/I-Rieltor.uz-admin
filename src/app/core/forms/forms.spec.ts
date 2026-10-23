import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormField } from '../../shared/ui/form-field/form-field';
import { ApiError } from '../http/api-error';
import { applyServerErrors } from './server-errors';
import {
  innValidator,
  matchesValidator,
  phoneValidator,
  pinflValidator,
  urlValidator,
} from './validators';

describe('validators', () => {
  const run = (validator: (c: FormControl) => unknown, value: unknown) =>
    validator(new FormControl(value));

  it('accept the formats the backend accepts and reject the others', () => {
    expect(run(phoneValidator, '+998901234567')).toBeNull();
    expect(run(phoneValidator, '998901234567')).toEqual({ phone: true });
    expect(run(phoneValidator, '+99890')).toEqual({ phone: true });
    expect(run(phoneValidator, '')).toBeNull();
    expect(run(pinflValidator, '12345678901234')).toBeNull();
    expect(run(pinflValidator, '1234567890123')).toEqual({ pinfl: true });
    expect(run(innValidator, '123456789')).toBeNull();
    expect(run(innValidator, '12345678')).toEqual({ inn: true });
    expect(run(urlValidator, 'https://maps.example/x')).toBeNull();
    expect(run(urlValidator, 'ftp://x')).toEqual({ url: true });
    expect(run(urlValidator, 'not a url')).toEqual({ url: true });
  });

  it('matchesValidator marks the second control when the values differ and clears it again', () => {
    const form = new FormGroup(
      { password: new FormControl('abc'), repeat: new FormControl('abd') },
      { validators: matchesValidator('password', 'repeat') },
    );
    expect(form.controls.repeat.errors).toEqual({ mismatch: true });
    form.controls.repeat.setValue('abc');
    expect(form.controls.repeat.errors).toBeNull();
  });
});

describe('applyServerErrors', () => {
  const error = new ApiError(400, 'Invalid', [
    'Title: is required',
    'Order: out of range',
    'Unknown: odd',
  ]);

  it('puts the messages on the matching controls (ignoring case) and returns the rest', () => {
    const form = new FormGroup({ title: new FormControl(''), order: new FormControl(0) });
    const rest = applyServerErrors(form, error);

    expect(form.controls.title.errors).toEqual({ server: ['is required'] });
    expect(form.controls.order.errors).toEqual({ server: ['out of range'] });
    expect(form.controls.title.touched).toBe(true);
    expect(rest).toEqual(['Unknown: odd']);
  });

  it('removes a field error as soon as the user edits the field, keeping the other errors', () => {
    const control = new FormControl('', Validators.required);
    const form = new FormGroup({ title: control });
    applyServerErrors(form, new ApiError(400, 'Invalid', ['Title: taken']));
    expect(control.errors).toEqual({ required: true, server: ['taken'] });
    control.setValue('x');
    expect(control.errors).toBeNull();
  });

  it('returns the message of a 400 that names no field', () => {
    expect(
      applyServerErrors(new FormGroup({}), new ApiError(400, 'Zakalat narxdan kam bo‘lsin')),
    ).toEqual(['Zakalat narxdan kam bo‘lsin']);
  });
});

@Component({
  imports: [FormField, ReactiveFormsModule],
  template: `
    <app-form-field label="Nomi" [control]="form.controls.title" [required]="true" hint="Qisqa nom">
      <input [formControl]="form.controls.title" />
    </app-form-field>
  `,
})
class Host {
  readonly form = new FormGroup({
    title: new FormControl('', [Validators.required, Validators.maxLength(3)]),
  });
}

describe('FormField', () => {
  it('shows the hint, then the messages of the control once it was touched or edited, then server errors', async () => {
    const fixture = TestBed.createComponent(Host);
    const el = fixture.nativeElement as HTMLElement;
    const control = fixture.componentInstance.form.controls.title;
    await fixture.whenStable();
    expect(el.textContent).toContain('Qisqa nom');
    expect(el.querySelector('.error')).toBeNull();

    control.markAsTouched();
    await fixture.whenStable();
    expect(el.querySelector('.error')?.textContent).toContain('To‘ldirish majburiy');
    expect(el.textContent).not.toContain('Qisqa nom');

    control.setValue('abcdef');
    await fixture.whenStable();
    expect(el.querySelector('.error')?.textContent).toContain('Ko‘pi bilan 3 belgi');

    applyServerErrors(fixture.componentInstance.form, new ApiError(400, 'x', ['Title: band']));
    await fixture.whenStable();
    expect(el.textContent).toContain('band');
  });
});

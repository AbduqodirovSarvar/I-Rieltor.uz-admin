import { Pipe, PipeTransform } from '@angular/core';
import { formatDate, formatDateTime } from '../time/tashkent';

const NBSP = ' ';

/** `1234567.5` → `1 234 567,5` (thin groups with a non-breaking space, comma decimals, at most 2 digits). */
export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  const [whole, fraction] = Math.abs(number).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const decimals = fraction === '00' ? '' : `,${fraction.replace(/0$/, '')}`;
  return `${number < 0 ? '−' : ''}${grouped}${decimals}`;
}

export function formatMoney(
  value: number | string | null | undefined,
  withCurrency = true,
): string {
  const text = formatNumber(value);
  return text && withCurrency ? `${text}${NBSP}so‘m` : text;
}

/** `+998901234567` → `+998 90 123 45 67`; anything else is returned as it is. */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return '';
  const match = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(value);
  return match ? `+998 ${match[1]} ${match[2]} ${match[3]} ${match[4]}` : value;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024)} KB`;
  return `${formatNumber(bytes / (1024 * 1024))} MB`;
}

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(value: number | string | null | undefined, withCurrency = true): string {
    return formatMoney(value, withCurrency);
  }
}

@Pipe({ name: 'dateTime' })
export class DateTimePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatDateTime(value);
  }
}

@Pipe({ name: 'dateOnly' })
export class DateOnlyPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatDate(value);
  }
}

@Pipe({ name: 'fileSize' })
export class FileSizePipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatFileSize(value);
  }
}

@Pipe({ name: 'phone' })
export class PhonePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatPhone(value);
  }
}

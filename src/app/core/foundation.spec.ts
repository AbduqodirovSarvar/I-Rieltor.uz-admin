import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HasPermissionDirective } from './auth/has-permission.directive';
import { Session } from './auth/session';
import { TokenStore } from './auth/token-store';
import { formatFileSize, formatMoney, formatNumber, formatPhone } from './format/format';
import { enumSeverity } from './i18n/enum-severity';
import { I18n } from './i18n/i18n.service';
import {
  calendarDay,
  endOfTashkentDayUtc,
  formatDate,
  formatDateTime,
  startOfTashkentDayUtc,
  tashkentInputToUtcIso,
  utcIsoToTashkentInput,
} from './time/tashkent';

describe('I18n', () => {
  const i18n = new I18n();

  it('finds texts, fills placeholders and shows the key of a missing text', () => {
    expect(i18n.t('common.save')).toBe('Saqlash');
    expect(i18n.t('common.total', { count: 5 })).toBe('Jami: 5');
    expect(i18n.t('common.missing' as never)).toBe('common.missing');
  });

  it('names enum values and lists them as options', () => {
    expect(i18n.enumLabel('AuctionStatus', 'ONGOING')).toBe('Savdo ketmoqda');
    expect(i18n.enumLabel('AuctionStatus', 'SOMETHING_NEW')).toBe('SOMETHING_NEW');
    expect(i18n.enumLabel('AuctionStatus', null)).toBe('');
    expect(i18n.enumOptions('ParticipantStatus').map((o) => o.value)).toEqual([
      'PENDING',
      'APPROVED',
      'REJECTED',
      'WITHDRAWN',
    ]);
    expect(enumSeverity('PaymentStatus', 'PAID')).toBe('success');
    expect(enumSeverity('PaymentStatus', 'UNKNOWN')).toBe('secondary');
  });
});

describe('formatting', () => {
  it('formats money with groups and optional decimals', () => {
    expect(formatMoney(1234567)).toBe('1 234 567 so‘m');
    expect(formatNumber(1500000.5)).toBe('1 500 000,5');
    expect(formatNumber('99.999')).toBe('100');
    expect(formatNumber(-2500)).toBe('−2 500');
    expect(formatMoney(null)).toBe('');
    expect(formatMoney(1000, false)).toBe('1 000');
  });

  it('formats phones and file sizes', () => {
    expect(formatPhone('+998901234567')).toBe('+998 90 123 45 67');
    expect(formatPhone('12345')).toBe('12345');
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(2048)).toBe('2 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB');
  });
});

describe('Tashkent time', () => {
  it('shows UTC time in Tashkent (UTC+5)', () => {
    expect(formatDateTime('2026-10-23T09:30:00Z')).toBe('23.10.2026 14:30');
    expect(formatDate('2026-12-31T20:00:00Z')).toBe('01.01.2027');
    expect(formatDateTime(null)).toBe('');
  });

  it('turns what the user typed in Tashkent time into UTC and back', () => {
    expect(tashkentInputToUtcIso('2026-10-23T14:30')).toBe('2026-10-23T09:30:00.000Z');
    expect(utcIsoToTashkentInput('2026-10-23T09:30:00Z')).toBe('2026-10-23T14:30');
    expect(utcIsoToTashkentInput(tashkentInputToUtcIso('2026-01-01T02:15'))).toBe(
      '2026-01-01T02:15',
    );
  });

  it('gives the UTC bounds of a Tashkent calendar day', () => {
    expect(startOfTashkentDayUtc('2026-10-23')).toBe('2026-10-22T19:00:00.000Z');
    expect(endOfTashkentDayUtc('2026-10-23')).toBe('2026-10-23T18:59:59.999Z');
    expect(calendarDay(new Date(2026, 9, 3))).toBe('2026-10-03');
  });
});

@Component({
  imports: [HasPermissionDirective],
  template: `
    <button *appHasPermission="required()" id="guarded">Delete</button>
    <span *appHasPermission="['A', 'B']" id="either">Either</span>
  `,
})
class Host {
  readonly required = signal('DELETE_USER');
}

describe('HasPermissionDirective', () => {
  const sessionWith = (permissions: string[]): Session => ({
    accessToken: `x.${btoa(JSON.stringify({ permission: permissions }))}.y`,
    refreshToken: 'r',
    accessTokenExpiration: new Date(Date.now() + 600_000).toISOString(),
    refreshTokenExpiration: new Date(Date.now() + 86_400_000).toISOString(),
    userId: 'u',
  });

  beforeEach(() => localStorage.clear());

  it('shows the element only while the user has the permission', async () => {
    const store = TestBed.inject(TokenStore);
    const fixture = TestBed.createComponent(Host);
    const el = fixture.nativeElement as HTMLElement;

    await fixture.whenStable();
    expect(el.querySelector('#guarded')).toBeNull();

    store.set(sessionWith(['DELETE_USER']));
    await fixture.whenStable();
    expect(el.querySelector('#guarded')).not.toBeNull();
    expect(el.querySelector('#either')).toBeNull();

    store.set(sessionWith(['B']));
    await fixture.whenStable();
    expect(el.querySelector('#guarded')).toBeNull();
    expect(el.querySelector('#either')).not.toBeNull();

    fixture.componentInstance.required.set('B');
    await fixture.whenStable();
    expect(el.querySelector('#guarded')).not.toBeNull();
  });
});

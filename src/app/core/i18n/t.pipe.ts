import { Pipe, PipeTransform, inject } from '@angular/core';
import { EnumName, I18n, TextKey } from './i18n.service';

/** `{{ 'common.save' | t }}` or `{{ 'common.total' | t: { count: 5 } }}`. */
@Pipe({ name: 't' })
export class TPipe implements PipeTransform {
  private readonly i18n = inject(I18n);

  transform(key: TextKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}

/** `{{ auction.status | enumLabel: 'AuctionStatus' }}`. */
@Pipe({ name: 'enumLabel' })
export class EnumLabelPipe implements PipeTransform {
  private readonly i18n = inject(I18n);

  transform(value: string | null | undefined, name: EnumName): string {
    return this.i18n.enumLabel(name, value);
  }
}

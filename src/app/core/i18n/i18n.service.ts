import { Injectable } from '@angular/core';
import { Dictionary, uz } from './uz';

type Paths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Paths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** A key such as `common.save`; a misspelled key does not compile. */
export type TextKey = Paths<Omit<Dictionary, 'enums'>>;

export type EnumName = keyof Dictionary['enums'];

/** Texts of the interface. One language now (uz); the dictionary is the only thing another language has to supply. */
@Injectable({ providedIn: 'root' })
export class I18n {
  private readonly dictionary: Dictionary = uz;

  t(key: TextKey, params?: Record<string, string | number>): string {
    let node: unknown = this.dictionary;
    for (const part of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[part];
    if (typeof node !== 'string') return key;
    return params
      ? node.replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match))
      : node;
  }

  /** The readable name of an enum value; unknown values are shown as they are. */
  enumLabel(name: EnumName, value: string | null | undefined): string {
    if (!value) return '';
    const labels = this.dictionary.enums[name] as Record<string, string>;
    return labels[value] ?? value;
  }

  /** All values of an enum as select options. */
  enumOptions(name: EnumName): { value: string; label: string }[] {
    return Object.entries(this.dictionary.enums[name]).map(([value, label]) => ({ value, label }));
  }
}

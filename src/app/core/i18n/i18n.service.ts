import { Injectable } from '@angular/core';
import { cyrillicDictionary } from './cyrillic';
import { en } from './en';
import { ru } from './ru';
import { Dictionary, uz } from './uz';

type Paths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Paths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** A key such as `common.save`; a misspelled key does not compile. */
export type TextKey = Paths<Omit<Dictionary, 'enums'>>;

export type EnumName = keyof Dictionary['enums'];

/** The four languages of the panel: Uzbek (Latin, the default), Russian, English and Uzbek in Cyrillic. */
export type Lang = 'uz' | 'ru' | 'en' | 'cyrl';
export const LANGS: readonly Lang[] = ['uz', 'ru', 'en', 'cyrl'];
export const LANG_NAME: Record<Lang, string> = {
  uz: 'O‘zbekcha',
  ru: 'Русский',
  en: 'English',
  cyrl: 'Ўзбекча',
};
const HTML_LANG: Record<Lang, string> = { uz: 'uz', ru: 'ru', en: 'en', cyrl: 'uz-Cyrl' };
export const LANG_STORAGE_KEY = 'irieltor.admin.lang';

/** Uzbek in Cyrillic is made from the Latin text (see `cyrillic.ts`), so the two scripts cannot drift apart. */
const DICTIONARIES: Record<Lang, Dictionary> = { uz, ru, en, cyrl: cyrillicDictionary(uz) };

function stored(): Lang {
  try {
    const value = globalThis.localStorage?.getItem(LANG_STORAGE_KEY);
    return LANGS.includes(value as Lang) ? (value as Lang) : 'uz';
  } catch {
    return 'uz';
  }
}

/**
 * Texts of the interface in the language the person chose (kept in this browser). Changing the language reloads the page, so
 * everything, including the components of the UI library, is built again in it.
 */
@Injectable({ providedIn: 'root' })
export class I18n {
  readonly lang: Lang = stored();
  private readonly dictionary: Dictionary = DICTIONARIES[this.lang];

  constructor() {
    globalThis.document?.documentElement.setAttribute('lang', HTML_LANG[this.lang]);
  }

  /** Saves the choice and reloads. */
  setLang(lang: Lang): void {
    if (lang === this.lang) return;
    try {
      globalThis.localStorage?.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // Storage blocked: the choice cannot be kept.
    }
    globalThis.location?.reload();
  }

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

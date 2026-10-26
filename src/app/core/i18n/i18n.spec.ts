import { en } from './en';
import { cyrillicDictionary } from './cyrillic';
import { primeLocale } from './primeng-locale';
import { ru } from './ru';
import { uz } from './uz';

/** The leaf texts of a nested dictionary, by their path. */
function leaves(node: unknown, path = ''): Record<string, string> {
  if (typeof node === 'string') return { [path]: node };
  return Object.assign(
    {},
    ...Object.entries(node as object).map(([key, value]) =>
      leaves(value, path ? `${path}.${key}` : key),
    ),
  );
}

describe('the languages of the panel', () => {
  const base = leaves(uz);

  for (const [name, dictionary] of Object.entries({ ru, en, cyrl: cyrillicDictionary(uz) })) {
    it(`${name} has the keys of Uzbek and the same {placeholders}`, () => {
      const other = leaves(dictionary);
      expect(Object.keys(other).sort()).toEqual(Object.keys(base).sort());
      const names = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
      for (const key of Object.keys(base)) expect(names(other[key]), key).toEqual(names(base[key]));
    });
  }

  for (const [name, dictionary] of Object.entries({ ru, en })) {
    it(`${name} has no empty text except where Uzbek has none`, () => {
      const other = leaves(dictionary);
      for (const [key, value] of Object.entries(other))
        if (base[key] !== '') expect(value, key).not.toBe('');
    });
  }

  it('the calendar of the UI library has names for every language', () => {
    for (const lang of ['uz', 'ru', 'en', 'cyrl'] as const) {
      expect(primeLocale(lang).monthNames).toHaveLength(12);
      expect(primeLocale(lang).dayNames).toHaveLength(7);
    }
    expect(primeLocale('cyrl').monthNames?.[0]).toBe('Январ');
  });
});

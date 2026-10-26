/**
 * Uzbek in the Cyrillic script, made from the Latin text by the rules of the Uzbek alphabets, so there is one source of text for
 * both scripts. Things that must stay as they are are left alone: `{placeholders}`, addresses and e-mails, names written in
 * capitals (E-IMZO, PINFL, SMS), and brand names.
 */

/** Names and words that are written in Latin letters in Cyrillic text too. */
const KEEP = [
  'I-Rieltor.uz',
  'I-Rieltor',
  'Rieltor',
  'Payme',
  'Click',
  'Uzum',
  'Telegram',
  'WhatsApp',
  'OpenStreetMap',
  'Google',
  'Yandex',
  'Maps',
  'Chrome',
  'Safari',
  'Firefox',
  'Email',
  'Swagger',
];

/** What is copied unchanged: placeholders, links, e-mails, names in capitals (E-IMZO, PINFL), the brand names above. */
const PROTECTED = new RegExp(
  [
    String.raw`\{[^}]*\}`,
    String.raw`https?:\/\/\S+`,
    String.raw`[\w.+-]+@[\w-]+(?:\.[\w-]+)+`,
    String.raw`\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b`,
    String.raw`\b(?:PINFL|INN|SMS|PDF|API|UZS|QR|URL|IBAN|MFO|ID|PNG|JPG|JPEG|DOCX|CSV|IP|OK)\b`,
    ...KEEP.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  ].join('|'),
  'g',
);

const isLetter = (ch: string | undefined) => !!ch && /[A-Za-z‘’'ʻʼ`]/.test(ch);
const isApostrophe = (ch: string | undefined) => !!ch && /[‘'ʻ`]/.test(ch);

const SINGLE: Record<string, string> = {
  a: 'а',
  b: 'б',
  d: 'д',
  e: 'е',
  f: 'ф',
  g: 'г',
  h: 'ҳ',
  i: 'и',
  j: 'ж',
  k: 'к',
  l: 'л',
  m: 'м',
  n: 'н',
  o: 'о',
  p: 'п',
  q: 'қ',
  r: 'р',
  s: 'с',
  t: 'т',
  u: 'у',
  v: 'в',
  x: 'х',
  y: 'й',
  z: 'з',
  c: 'к',
  w: 'в',
};

/** The result for the case of what was read: "Sh" → "Ш", "SH" → "Ш", "sh" → "ш"; a letter pair read as capitals stays capitals. */
function withCase(read: string, result: string, nextIsUpper: boolean): string {
  const first = read[0];
  if (first !== first.toUpperCase() || first === first.toLowerCase()) return result;
  const allUpper = read.length > 1 ? read === read.toUpperCase() : nextIsUpper;
  return allUpper && read.length > 1
    ? result.toUpperCase()
    : result[0].toUpperCase() + result.slice(1);
}

/** Words that the Cyrillic spelling writes differently from the sound-by-sound rules (loanwords). */
const STEMS: [string, string][] = [
  ['auksion', 'аукцион'],
  ['obyekt', 'объект'],
];

function word(text: string): string {
  const lower = text.toLowerCase();
  for (const [stem, cyrillic] of STEMS) {
    if (lower.startsWith(stem)) {
      const capital = text[0] === text[0].toUpperCase() && text[0] !== text[0].toLowerCase();
      const head = capital ? cyrillic[0].toUpperCase() + cyrillic.slice(1) : cyrillic;
      return head + word(text.slice(stem.length));
    }
  }
  return plain(text);
}

function plain(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const lower = ch.toLowerCase();
    const next = text[i + 1];
    const nextLower = next?.toLowerCase();
    const atStart = i === 0 || !isLetter(text[i - 1]);

    // o‘ and g‘ (the apostrophe after o or g makes a separate letter)
    if ((lower === 'o' || lower === 'g') && isApostrophe(next)) {
      out += withCase(ch, lower === 'o' ? 'ў' : 'ғ', false);
      i += 2;
      continue;
    }
    // the tutuq sign: ma’lumot -> маълумот
    if (/[’ʼ]/.test(ch)) {
      out += 'ъ';
      i += 1;
      continue;
    }
    if (isApostrophe(ch)) {
      out += 'ъ';
      i += 1;
      continue;
    }
    const pair = lower + (nextLower ?? '');
    const pairRead = text.slice(i, i + 2);
    const upperNext = !!next && next === next.toUpperCase() && next !== next.toLowerCase();
    if (pair === 'sh') {
      out += withCase(pairRead, 'ш', upperNext);
      i += 2;
      continue;
    }
    if (pair === 'ch') {
      out += withCase(pairRead, 'ч', upperNext);
      i += 2;
      continue;
    }
    if (pair === 'ng') {
      out +=
        withCase(ch, 'н', false) +
        (next === next.toUpperCase() && next !== next.toLowerCase() ? 'Г' : 'г');
      i += 2;
      continue;
    }
    // "yo‘q" is й + ў, not ё: the apostrophe after o belongs to o.
    if (
      lower === 'y' &&
      atStart &&
      nextLower &&
      'aoue'.includes(nextLower) &&
      !(nextLower === 'o' && isApostrophe(text[i + 2]))
    ) {
      const result = { a: 'я', o: 'ё', u: 'ю', e: 'е' }[nextLower]!;
      out += withCase(pairRead, result, upperNext);
      i += 2;
      continue;
    }
    if (lower === 'e' && atStart) {
      out += withCase(ch, 'э', false);
      i += 1;
      continue;
    }
    const mapped = SINGLE[lower];
    out += mapped ? withCase(ch, mapped, false) : ch;
    i += 1;
  }
  return out;
}

/** The Cyrillic form of an Uzbek (Latin) text. */
export function toCyrillic(text: string): string {
  let result = '';
  let last = 0;
  for (const match of text.matchAll(PROTECTED)) {
    result += convert(text.slice(last, match.index));
    result += match[0];
    last = match.index + match[0].length;
  }
  return result + convert(text.slice(last));
}

function convert(part: string): string {
  // Words are separated at anything that is not a letter, so "ariza-nomа" and "(ikki)" are read word by word.
  return part.replace(/[A-Za-z‘’'ʻʼ`]+/g, (w) => word(w));
}

/** The same dictionary in Cyrillic: every text of a flat or nested dictionary is converted, the keys stay. */
export function cyrillicDictionary<T>(dictionary: T): T {
  if (typeof dictionary === 'string') return toCyrillic(dictionary) as T;
  if (dictionary && typeof dictionary === 'object')
    return Object.fromEntries(
      Object.entries(dictionary).map(([key, value]) => [key, cyrillicDictionary(value)]),
    ) as T;
  return dictionary;
}

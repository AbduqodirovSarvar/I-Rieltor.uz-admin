import type { Translation } from 'primeng/api';
import { toCyrillic } from './cyrillic';
import type { Lang } from './i18n.service';

const UZ_DAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const UZ_MONTHS = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'Iyun',
  'Iyul',
  'Avgust',
  'Sentabr',
  'Oktabr',
  'Noyabr',
  'Dekabr',
];
const RU_DAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const RU_MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];
const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EN_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const short = (names: string[], length = 3) => names.map((n) => n.slice(0, length));

function calendar(days: string[], months: string[], first: number): Partial<Translation> {
  return {
    firstDayOfWeek: first,
    dayNames: days,
    dayNamesShort: short(days),
    dayNamesMin: short(days, 2),
    monthNames: months,
    monthNamesShort: short(months),
  };
}

const TEXTS: Record<Lang, Partial<Translation>> = {
  uz: {
    ...calendar(UZ_DAYS, UZ_MONTHS, 1),
    today: 'Bugun',
    clear: 'Tozalash',
    apply: 'Qo‘llash',
    cancel: 'Bekor qilish',
    weekHeader: 'Hf',
  },
  ru: {
    ...calendar(RU_DAYS, RU_MONTHS, 1),
    today: 'Сегодня',
    clear: 'Очистить',
    apply: 'Применить',
    cancel: 'Отмена',
    weekHeader: 'Нед',
  },
  en: {
    ...calendar(EN_DAYS, EN_MONTHS, 1),
    today: 'Today',
    clear: 'Clear',
    apply: 'Apply',
    cancel: 'Cancel',
    weekHeader: 'Wk',
  },
  cyrl: {
    ...calendar(UZ_DAYS.map(toCyrillic), UZ_MONTHS.map(toCyrillic), 1),
    today: 'Бугун',
    clear: 'Тозалаш',
    apply: 'Қўллаш',
    cancel: 'Бекор қилиш',
    weekHeader: 'Ҳф',
  },
};

/** The texts that the UI library draws itself (calendar names, buttons), in the language of the panel. */
export function primeLocale(lang: Lang): Partial<Translation> {
  return TEXTS[lang];
}

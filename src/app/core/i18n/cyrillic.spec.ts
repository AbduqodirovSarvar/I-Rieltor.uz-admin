import { cyrillicDictionary, toCyrillic } from './cyrillic';

describe('Uzbek Latin to Cyrillic', () => {
  const cases: [string, string][] = [
    ['Ko‘chmas mulk auksionlari', 'Кўчмас мулк аукционлари'],
    ['Biz haqimizda', 'Биз ҳақимизда'],
    ['Ma’lumot', 'Маълумот'],
    ['Yangi obyekt', 'Янги объект'],
    ['Ro‘yxatdan o‘tish', 'Рўйхатдан ўтиш'],
    ['yo‘q', 'йўқ'],
    ['Elektron pochta', 'Электрон почта'],
    ['Chiqish', 'Чиқиш'],
    ['Qidirish', 'Қидириш'],
    ['Yuklanmoqda…', 'Юкланмоқда…'],
    ['SHAHAR', 'ШАҲАР'],
    ['Tuman va ko‘cha', 'Туман ва кўча'],
    ['mayda', 'майда'],
    ['Gap', 'Гап'],
    ['G‘olib', 'Ғолиб'],
    ['Zakalat', 'Закалат'],
    ['Ishtirokchi raqamingiz', 'Иштирокчи рақамингиз'],
  ];
  for (const [latin, cyrillic] of cases)
    it(`${latin} -> ${cyrillic}`, () => expect(toCyrillic(latin)).toBe(cyrillic));

  it('leaves placeholders, names in capitals, brand names, links and e-mails alone', () => {
    expect(toCyrillic('{count} ta obyekt')).toBe('{count} та объект');
    expect(toCyrillic('E-IMZO kaliti va PINFL')).toBe('E-IMZO калити ва PINFL');
    expect(toCyrillic('I-Rieltor: Payme yoki Click')).toBe('I-Rieltor: Payme ёки Click');
    expect(toCyrillic('Yozing: info@i-rieltor.uz yoki https://i-rieltor.uz/katalog')).toBe(
      'Ёзинг: info@i-rieltor.uz ёки https://i-rieltor.uz/katalog',
    );
    expect(toCyrillic('{n} / {total}')).toBe('{n} / {total}');
  });

  it('converts every text of a nested dictionary and keeps the keys', () => {
    expect(cyrillicDictionary({ a: { b: 'Saqlash' }, c: 'Bekor qilish' })).toEqual({
      a: { b: 'Сақлаш' },
      c: 'Бекор қилиш',
    });
  });
});

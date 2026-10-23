# I-Rieltor.uz admin paneli

Angular 22 (standalone komponentlar, signal), PrimeNG, SPA (SSR yo'q). Reja va holat: `../development/ADMIN_REJA.md`.

## Ishga tushirish

Backend (lokal Docker) `http://localhost:8080` da ishlab turishi kerak (`../I-Rieltor.uz-backend/deploy/local/README.md`).

```
npm install            # .npmrc: legacy-peer-deps (openapi-typescript TypeScript 6 ni hali e'lon qilmagan)
npm start              # http://localhost:4200, /api /hubs /uploads /swagger backendga proksi qilinadi (proxy.conf.json)
npm run api:types      # backend Swagger'idan src/app/api/schema.d.ts ni qayta yaratadi
npm run lint           # ESLint
npm run format         # Prettier
npm test               # birlik testlari (Vitest, jsdom): ng test --watch=false
npm run build          # statik build: dist/I-Rieltor.uz-admin/browser
```

`ng serve` proksi orqali ishlagani uchun dev'da CORS kerak emas. Production'da `src/environments/environment.ts` dagi `apiUrl`
(`https://api.i-rieltor.uz`) ishlatiladi va backendning `Cors__AllowedOrigins__*` ida admin manzili bo'lishi shart.

## Tuzilma

```
src/app/
  core/       sozlama, HTTP, auth, ruxsatlar, i18n, mavzu
  shared/     umumiy komponentlar (jadval, filtr, forma, dialog), pipelar, layout
  features/   bo'limlar (dashboard, users, auctions, ...): har biri lazy `*.routes.ts`, `*.service.ts`, sahifalar
  api/        schema.d.ts (generatsiya qilingan, qo'lda o'zgartirilmaydi)
src/environments/   environment.ts (production), environment.development.ts
```

## Konvensiyalar
- Komponent selektori `app-` bilan; fayl nomlari `kebab-case`; har bir xizmat/komponent yoniga `*.spec.ts`.
- Backenddan kelgan vaqt UTC, ekranda Asia/Tashkent; serverga doim `Z` yoki offset bilan yuboriladi.
- Matnlar kodda emas, `core/i18n` lug'atida (o'zbek, lotin).
- Commit xabari band raqami bilan: `A1-3: refresh single-flight`.
- `src/app/api/schema.d.ts` ni backend o'zgargach `npm run api:types` bilan yangilang va commit qiling.
- `/dev/ui` sahifasi faqat tema va komponentlarni ko'zdan kechirish uchun.

## PrimeNG litsenziyasi
PrimeNG 22 tijoriy litsenziyali kutubxona; tashkilot shartlarga mos kelsa **Community License** bepul (yillik tasdiqlash bilan,
https://primeui.dev/licenses/community). Kalitni `src/environments/environment.ts` va `environment.development.ts` dagi `primeLicense`
ga yozing. Kalit bo'sh bo'lsa sahifa pastki o'ng burchagida litsenziya ogohlantirishi chiqadi. Kalit bir yillik; muddati tugashidan
oldin yangilang.

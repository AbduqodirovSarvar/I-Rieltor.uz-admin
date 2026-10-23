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

## Docker (statik build + nginx)
`Dockerfile` statik saytni quradi va nginx bilan beradi (`nginx.conf`: SPA fallback `try_files`, `/api` `/uploads` `/hubs` `/swagger` ni `api`
konteyneriga proksi qilish, keshlash, CSP va boshqa xavfsizlik sarlavhalari). Brauzer admin va API ni **bitta manzildan** ko'radi, shuning uchun
CORS kerak emas (`ng build --configuration docker`, `environment.docker.ts`, `apiUrl: ''`).

- Backend papkasidagi `docker-compose.yml` da `admin` xizmati bor: `http://localhost:8081` (`.env` da `ADMIN_PORT`).
- Lokal: `..\I-Rieltor.uz-backend\deploy\local\up.ps1` adminni ham hostda quradi (`Dockerfile.local`, korporativ TLS sababli) va ishga tushiradi.
- Admin alohida domenda (`admin.i-rieltor.uz`) va `environment.ts` dagi `apiUrl` bilan qurilsa, backendning `Cors__AllowedOrigins__*` ida
  admin manzili bo'lishi shart (`.env.example` da bor).
- CSP `script-src 'self'` — shuning uchun build'da kritik CSS inline qilinmaydi (`inlineCritical: false`); yangi inline skript qo'shmang.
- HTTPS: backenddagi nginx/certbot sxemasi API uchun; admin konteyneri ham shunday sertifikat ortiga qo'yilishi kerak (hozircha HTTP).

## Ruxsatlar xaritasi (sahifa → ruxsat)
`/users` READ_USER · `/roles` READ_USERROLE · `/slides` READ_SLIDE · `/company` READ_COMPANY · `/categories` READ_PROPERTYCATEGORY ·
`/properties` READ_PROPERTY · `/auctions` READ_AUCTION · `/participants` READ_AUCTIONPARTICIPANT · `/documents` READ_PRIVATEDOCUMENT ·
`/payments` READ_PAYMENT · `/audit` READ_AUDITLOG · `/notifications` READ_NOTIFICATION. Tugmalar `*appHasPermission` bilan (CREATE_/UPDATE_/DELETE_ ...).

## Yangi ekran qo'shish
1. `features/<nom>/` da xizmat (`ApiClient`), sahifa(lar), `*.spec.ts`. 2. `app.routes.ts` ga lazy marshrut: `canActivate: [permissionGuard]`, `data: { permission, title }`.
3. `core/layout/nav.ts` ga menyu bandi (`ready: true`). 4. Matnlar `core/i18n/uz.ts` ga. 5. `npm run format; npm run lint; npm test; npm run build`.

## E2E (Playwright)
Haqiqiy brauzer (Chromium) lokal stackga qarshi: `npx playwright install chromium` (bir marta), stackni `..\I-Rieltor.uz-backend\deploy\local\up.ps1` bilan
ko'taring, so'ng (PowerShell):
```
$env:E2E_LOGIN="<DefaultAdmin__Email>"; $env:E2E_PASSWORD="<DefaultAdmin__Password>"; npm run e2e
```
`E2E_BASE_URL` (standart `http://127.0.0.1:8081`). Sinovlar: noto'g'ri parol, kirishdan keyin qaytish, barcha bo'limlar xatosiz (skript/CSP/5xx, nomsiz tugma yo'q), uslub va sessiya, audit, chiqish, hamda admin oqimi: toifa → obyekt → auksion → e'lon (`flow.spec.ts`; lokal bazada `E2E ...` nomli yozuvlar qoladi).

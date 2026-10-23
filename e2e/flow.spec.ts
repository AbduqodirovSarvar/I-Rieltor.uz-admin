import { expect, Page, test } from '@playwright/test';

const login = process.env['E2E_LOGIN'] ?? '';
const password = process.env['E2E_PASSWORD'] ?? '';
test.skip(!login || !password, 'set E2E_LOGIN and E2E_PASSWORD');

/** `yyyy-MM-ddTHH:mm` for a `datetime-local` input, `days` from now (the browser runs in Asia/Tashkent). */
function local(days: number, hours = 0): string {
  const d = new Date(Date.now() + days * 86_400_000 + hours * 3_600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function signIn(page: Page) {
  await page.goto('/login');
  await page.locator('#login').fill(login);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /Kirish/ }).click();
  await expect(page).not.toHaveURL(/login/);
}

test('the admin side of the deal: category → property → auction → publish', async ({ page }) => {
  const run = Date.now().toString(36);
  const category = `E2E toifa ${run}`;
  const property = `E2E uy ${run}`;
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 500) problems.push(`${r.status()} ${r.url()}`);
  });
  await signIn(page);

  // Category (dialog).
  await page.goto('/categories');
  await page.getByRole('button', { name: 'Yangi toifa' }).click();
  await page.locator('#catName').fill(category);
  await page.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByText(category).first()).toBeVisible();

  // Property.
  await page.goto('/properties/new');
  await page.locator('#pTitle').fill(property);
  await page.locator('#pCategory').click();
  await page.getByRole('option', { name: category }).click();
  await page.locator('#pStatus').click();
  await page.getByRole('option', { name: 'Katalogda' }).click();
  await page.locator('#pRegion').fill('Toshkent');
  await page.locator('#pAddress').fill('Amir Temur ko‘chasi 1');
  await page.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);
  await expect(page.getByText(property).first()).toBeVisible();

  // Auction on that property (a draft first).
  await page.goto('/auctions/new');
  await page.locator('#aProperty').click();
  await page.locator('#aProperty').fill(property);
  await page.getByRole('option', { name: property }).click();
  await page.locator('input#aStart').fill('100000000');
  await page.locator('input#aStep').fill('1000000');
  await page.locator('input#aDeposit').fill('10000000');
  await page.locator('#aDeadline').fill(local(1));
  await page.locator('#aStarts').fill(local(2));
  await page.locator('#aEnds').fill(local(3));
  await page.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page).toHaveURL(/\/auctions\/[0-9a-f-]{36}$/);

  // Publish.
  await page.getByRole('button', { name: 'E’lon qilish' }).click();
  await page.locator('.p-confirmdialog button').last().click();
  await expect(page.getByText('Auksion e’lon qilindi').first()).toBeVisible();

  // It shows up in the lists.
  await page.goto('/auctions');
  await expect(page.getByText(property).first()).toBeVisible();
  expect(problems).toEqual([]);
});

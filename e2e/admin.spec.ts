import { expect, Page, test } from '@playwright/test';

const login = process.env['E2E_LOGIN'] ?? '';
const password = process.env['E2E_PASSWORD'] ?? '';

/** Collects what a user would never want to see: script errors, CSP violations, server errors. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 500) problems.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  });
  return problems;
}

async function signIn(page: Page) {
  await page.goto('/login');
  await page.locator('#login').fill(login);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /Kirish/ }).click();
  await expect(page).not.toHaveURL(/login/);
}

test.skip(!login || !password, 'set E2E_LOGIN and E2E_PASSWORD');

test('a wrong password is refused with a message and stays on the sign-in page', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#login').fill(login);
  await page.locator('#password').fill(`${password}-wrong`);
  await page.getByRole('button', { name: /Kirish/ }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/login/);
});

test('a visitor is sent to the sign-in page, and comes back to the page after signing in', async ({ page }) => {
  await page.goto('/auctions');
  await expect(page).toHaveURL(/login/);
  await page.locator('#login').fill(login);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /Kirish/ }).click();
  await expect(page).toHaveURL(/\/auctions/);
});

test('every section opens without script errors, CSP violations or server errors', async ({ page }) => {
  const problems = watch(page);
  const nameless: string[] = [];
  await signIn(page);
  const routes = [
    '/', '/users', '/roles', '/slides', '/company', '/categories', '/properties', '/auctions',
    '/participants', '/documents', '/payments', '/audit', '/notifications', '/profile',
  ];
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator('app-page-header, .dashboard, h1').first()).toBeVisible();
    await expect(page).not.toHaveURL(/forbidden|login/);
    await page.waitForLoadState('networkidle');
    nameless.push(
      ...(await page.evaluate(() =>
        [...document.querySelectorAll('button')]
          .filter((b) => !(b.textContent ?? '').trim() && !b.getAttribute('aria-label') && !b.getAttribute('aria-labelledby') && !b.title)
          .map((b) => `${location.pathname}: ${b.outerHTML.slice(0, 400)}`),
      )),
    );
  }
  expect(problems).toEqual([]);
  // A button with only an icon needs a name for screen readers.
  expect(nameless).toEqual([]);
});

test('the page is styled (the stylesheet is not blocked) and the session survives a reload', async ({ page }) => {
  await signIn(page);
  const sidebar = page.locator('nav').first();
  await expect(sidebar).toBeVisible();
  const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(font).toContain('Onest');
  await page.reload();
  await expect(page).not.toHaveURL(/login/);
});

test('audit journal shows the sign-in that just happened and the errors view filters', async ({ page }) => {
  await signIn(page);
  await page.goto('/audit');
  await expect(page.locator('p-table tbody tr').first()).toBeVisible();
  await page.getByText('Faqat xatolar (4xx/5xx)').click();
  await page.waitForLoadState('networkidle');
  for (const code of await page.locator('.code').allTextContents()) {
    expect(Number(code)).toBeGreaterThanOrEqual(400);
  }
});

test('signing out ends the session', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: /Chiqish/ }).first().click();
  await expect(page).toHaveURL(/login/);
  await page.goto('/users');
  await expect(page).toHaveURL(/login/);
});

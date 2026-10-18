import { test, expect } from '@playwright/test';

const locales = ['es-ES', 'es-MX', 'es-AR', 'es-CO'];
for (const locale of locales) {
  test(`Spanish browser ${locale} lands on /es/`, async ({ browser }) => {
    const context = await browser.newContext({ locale });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/');
    await expect(page).toHaveURL(/\/es\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.locator('#lead-form')).toBeVisible();
    await context.close();
  });
}
test('direct Spanish link is preserved in English browser', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US' });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/es/');
  await expect(page).toHaveURL(/\/es\/$/);
  await context.close();
});
test('manual English preference overrides Spanish browser on root', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'es-ES' });
  await context.addInitScript(() => localStorage.setItem('ajg_language_preference', 'en'));
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/');
  await expect(page).toHaveURL(/\/en\/$/);
  await context.close();
});
test('Spanish form validates and submits successfully with mocked API', async ({ page }) => {
  await page.route('**/api/funnel-event', route => route.fulfill({ status: 200, body: '{}' }));
  let submitted = null;
  await page.route('**/api/travel-presentation', async route => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.goto('http://127.0.0.1:4173/es/');
  await page.locator('#discover').scrollIntoViewIfNeeded();
  for (let step = 1; step <= 3; step++) {
    await page.locator(`.form-step[data-step="${step}"] input[type="radio"]`).first().check();
    await page.locator('#next-btn').click();
  }
  await page.locator('input[name="prenom"]').fill('Prueba');
  await page.locator('input[name="email"]').fill('prueba@example.com');
  await page.locator('#submit-btn').click();
  await expect(page).toHaveURL(/\/es\/thanks\\.html$/);
  expect(submitted?.language).toBe('es');
});
test('Spanish pages and internal links load', async ({ page }) => {
  for (const path of ['/es/', '/es/thanks.html', '/es/legal.html', '/es/privacy.html', '/es/blog/', '/es/blog/marrakech/', '/es/blog/andalusia/']) {
    const response = await page.goto('http://127.0.0.1:4173' + path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  }
});

import { expect, test } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const session = process.env.TBT_TEST_SESSION;

test.use({ baseURL });

test('signed-in visitors leave login for their campaigns', async ({ page, context }) => {
  test.skip(!session, 'Requires a valid local test-account session.');
  await context.addCookies([
    { name: 'tbt_session', value: session!, url: baseURL, httpOnly: true, sameSite: 'Lax' },
  ]);
  await page.goto('/login');
  await expect(page).toHaveURL(`${baseURL}/c`);
  await expect(page.getByRole('heading', { name: 'Your campaigns' })).toBeVisible();
});

for (const token of ['', 'invalid-session']) {
  test(`login remains available with ${token ? 'an invalid session' : 'no session'}`, async ({
    page,
    context,
  }) => {
    if (token) {
      await context.addCookies([
        { name: 'tbt_session', value: token, url: baseURL, httpOnly: true, sameSite: 'Lax' },
      ]);
    }
    await page.goto('/login');
    await expect(page).toHaveURL(`${baseURL}/login`);
    await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  });
}

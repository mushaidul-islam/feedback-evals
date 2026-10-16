import { expect, test } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const session = process.env.TBT_TEST_SESSION;
const campaignID = process.env.TBT_TEST_CAMPAIGN_ID;

test.use({ baseURL });

for (const width of [1280, 768, 390]) {
  test(`create button stays in place while creating at ${width}px`, async ({ page, context }) => {
    test.skip(!session, 'Set TBT_TEST_SESSION to a valid local test-account session.');
    await page.setViewportSize({ width, height: 1000 });
    await context.addCookies([
      { name: 'tbt_session', value: session!, url: baseURL, httpOnly: true, sameSite: 'Lax' },
    ]);

    // Delay and then abort creation so the real pending UI is exercised
    // without saving a test campaign in the application's database.
    let release = () => {};
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/campaign', async (route) => {
      if (route.request().method() === 'POST') {
        await pending;
        await route.abort('failed');
      } else {
        await route.continue();
      }
    });

    await page.goto('/c');
    await expect(page.getByRole('heading', { name: 'Your campaigns' })).toBeVisible();
    await page.getByLabel('Campaign name', { exact: true }).fill('Layout regression');
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const input = page.getByLabel('Campaign name', { exact: true });
    const button = page.getByRole('button', { name: 'Create campaign', exact: true });
    const before = await button.boundingBox();
    const inputBox = await input.boundingBox();
    expect(before).not.toBeNull();
    expect(inputBox).not.toBeNull();
    if (width >= 640) {
      expect(Math.abs(inputBox!.width / before!.width - 3)).toBeLessThan(0.05);
    } else {
      expect(before!.y).toBeGreaterThanOrEqual(inputBox!.y + inputBox!.height);
      expect(Math.abs(before!.width - inputBox!.width)).toBeLessThan(1);
    }

    try {
      await button.click();
      const creating = page.getByRole('button', { name: 'Creating…', exact: true });
      await expect(creating).toBeDisabled();
      // Let the existing 200ms button transition finish before comparing.
      await page.waitForTimeout(250);
      const during = await creating.boundingBox();
      expect(during).not.toBeNull();
      for (const dimension of ['x', 'y', 'width', 'height'] as const) {
        expect(Math.abs(during![dimension] - before![dimension])).toBeLessThan(1);
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    } finally {
      release();
    }
    await expect(page.getByRole('button', { name: 'Create campaign', exact: true })).toBeEnabled();
    await expect(page.getByText('Could not create the campaign. Please try again.')).toBeVisible();
  });
}

test('public page identifies the creator and keeps the source link when an embed is blocked', async ({
  page,
  request,
}) => {
  test.skip(!campaignID, 'Set TBT_TEST_CAMPAIGN_ID to a local campaign with a content link.');
  const response = await request.get(`/api/campaign/${campaignID}/public`);
  expect(response.ok()).toBe(true);
  const campaign = await response.json();
  expect(campaign.content).toBeTruthy();

  // Simulate a provider being blocked. The app and API are real, and the
  // collection page must remain useful without the external provider.
  if (campaign.content.embed_url) {
    await page.route(campaign.content.embed_url, (route) => route.abort('failed'));
  }
  await page.route('https://platform.twitter.com/widgets.js', (route) => route.abort('failed'));
  await page.route('https://www.instagram.com/embed.js', (route) => route.abort('failed'));
  await page.goto(`/f/c/${campaignID}`);
  await expect(page.getByRole('heading', { name: campaign.name, exact: true })).toBeVisible();
  await expect(
    page.getByText(campaign.creator_name?.trim() || 'Someone', { exact: true }),
  ).toBeVisible();
  const original = page.getByRole('link', {
    name: `Open original on ${campaign.content.provider}`,
  });
  await expect(original).toBeVisible();
  await expect(original).toHaveAttribute('href', campaign.content.url);
  await expect(page.getByRole('textbox')).toBeVisible();
});

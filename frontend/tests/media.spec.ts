import { expect, test } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const session = process.env.TBT_TEST_SESSION;
test.use({ baseURL });
test.beforeEach(async ({ context }) => {
  test.skip(!session, 'Requires a local test session; use a disposable database.');
  await context.addCookies([{ name: 'tbt_session', value: session!, url: baseURL, httpOnly: true }]);
});

for (const content of [
  { type: 'image', url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-images/flower.jpg', provider: 'Image' },
  { type: 'video', url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', provider: 'Video' },
  { type: 'embed', url: 'https://example.org/#article', provider: 'Website' },
  { type: 'embed', url: 'https://drive.google.com/file/d/public-file-example/view?resourcekey=sample', provider: 'Google Drive' },
  { type: 'embed', url: 'https://youtu.be/dQw4w9WgXcQ', provider: 'YouTube' },
]) {
  test(`create and display ${content.provider} content`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/c');
    await page.getByLabel('Campaign name', { exact: true }).fill(`Media regression: ${content.provider}`);
    await page.getByLabel('Content type', { exact: true }).selectOption(content.type);
    await page.getByLabel('Content link (optional)', { exact: true }).fill(content.url);
    await page.getByRole('button', { name: 'Create campaign', exact: true }).click();
    await expect(page).toHaveURL(/\/c\/[\w-]+$/);
    const id = new URL(page.url()).pathname.split('/').pop();
    const response = await page.request.get(`/api/campaign/${id}/public`);
    expect(response.ok()).toBe(true);
    const saved = await response.json();
    expect(saved.content).toMatchObject({ type: content.type, provider: content.provider, url: content.url });
    await page.goto(`/f/c/${id}`);
    const region = page.getByRole('region', { name: 'Campaign content' });
    await expect(region.locator('svg')).toBeVisible();
    await expect(region.getByRole('link', { name: /Open original/ })).toHaveAttribute('href', content.url);
    if (content.type === 'image') {
      await expect(region.getByRole('img', { name: 'Campaign image' })).toHaveAttribute('src', content.url);
      // A failed external image must retain the original link and feedback form.
      await page.route(content.url, route => route.abort('failed'));
      await page.reload();
      await expect(region.getByText('Preview unavailable.', { exact: false })).toBeVisible();
      await expect(region.getByRole('link', { name: 'Open original', exact: true })).toBeVisible();
    } else if (content.type === 'video') {
      await expect(region.locator('video')).toHaveAttribute('src', content.url);
      await expect(region.locator('video')).toHaveAttribute('controls', '');
    } else {
      const frame = region.locator('iframe');
      await expect(frame).toHaveAttribute('src', saved.content.embed_url);
      if (content.provider === 'Website') {
        await expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
        await expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer');
      } else {
        await expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
      }
    }
    await expect(page.getByRole('textbox')).toBeVisible();
    await page.setViewportSize({ width: 320, height: 900 });
    await page.getByRole('button', { name: /View content/ }).click();
    await expect(region).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

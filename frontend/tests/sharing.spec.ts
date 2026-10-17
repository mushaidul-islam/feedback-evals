import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';
import jsQR from 'jsqr';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const campaignID = process.env.TBT_TEST_CAMPAIGN_ID;
const session = process.env.TBT_TEST_SESSION;
test.use({ baseURL });

test.beforeEach(async ({ context }) => {
  test.skip(!campaignID || !session, 'Requires a local test campaign and owner session.');
  await context.addCookies([
    { name: 'tbt_session', value: session!, url: baseURL, httpOnly: true },
  ]);
});

for (const width of [1440, 390, 320]) {
  test(`campaign sharing exports a story card at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    const campaignResponse = page.waitForResponse((response) =>
      response.url().endsWith(`/api/campaign/${campaignID}`),
    );
    await page.goto(`/c/${campaignID}`);
    const campaign = await (await campaignResponse).json();
    await expect(page.getByRole('heading', { name: 'Feedback', exact: true })).toBeVisible();
    const preview = page.getByRole('region', { name: 'Campaign content' });
    if (width >= 1024) {
      const contentBox = await preview.boundingBox();
      const feedbackBox = await page
        .getByRole('region', { name: 'Received feedback' })
        .boundingBox();
      expect(contentBox!.x + contentBox!.width).toBeLessThan(feedbackBox!.x);
    } else {
      await expect(preview).not.toBeVisible();
      await page.getByRole('button', { name: /View content/ }).click();
      await expect(preview).toBeVisible();
      await page.getByRole('button', { name: /Hide content/ }).click();
      await expect(preview).not.toBeVisible();
    }
    await page.getByRole('button', { name: 'Share campaign', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('img', { name: 'Share card preview' })).toBeVisible();
    await expect(dialog.getByLabel('Feedback link', { exact: true })).toHaveValue(
      `${baseURL}/f/c/${campaignID}`,
    );
    const downloadEvent = page.waitForEvent('download');
    await dialog.getByRole('link', { name: 'Download image', exact: true }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toMatch(/campaign.*\.png$/);
    const png = await readFile((await download.path())!);
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1080);
    expect(png.readUInt32BE(20)).toBe(1920);
    if (width === 1440) {
      const pixels = await page.evaluate(async (base64) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = 540;
        canvas.height = 960;
        const context = canvas.getContext('2d')!;
        context.drawImage(image, 0, 0, 540, 960);
        const thumbnail = context.getImageData(52, 615, 90, 50).data;
        const colors = new Set<string>();
        for (let offset = 0; offset < thumbnail.length; offset += 8) {
          colors.add(Array.from(thumbnail.slice(offset, offset + 3)).join(','));
        }
        return {
          qr: Array.from(context.getImageData(30, 690, 180, 180).data),
          thumbnailColors: colors.size,
        };
      }, png.toString('base64'));
      expect(jsQR(new Uint8ClampedArray(pixels.qr), 180, 180)?.data).toBe(
        `${baseURL}/f/c/${campaignID}`,
      );
      if (campaign.content?.provider === 'YouTube') {
        // A real thumbnail has varied pixels; the old text-only card is flat here.
        expect(pixels.thumbnailColors).toBeGreaterThan(100);
      }
    }
    await download.saveAs(test.info().outputPath('campaign-card.png'));
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Share campaign', exact: true })).toBeFocused();
    expect(errors).toEqual([]);
  });
}

test('sharing still exports an image when the content thumbnail is blocked', async ({ page }) => {
  // Fault injection only: the app and API run normally, but image loading fails.
  await page.route('**/_next/image?*', (route) => route.abort('failed'));
  await page.goto(`/c/${campaignID}`);
  await page.getByRole('button', { name: 'Share campaign', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('img', { name: 'Share card preview' })).toBeVisible();
  const downloadEvent = page.waitForEvent('download');
  await dialog.getByRole('link', { name: 'Download image', exact: true }).click();
  const download = await downloadEvent;
  const png = await readFile((await download.path())!);
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
});

test('saved feedback has its own downloadable card', async ({ page }) => {
  await page.goto(`/c/${campaignID}`);
  await page.getByRole('button', { name: 'Share feedback', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Share this feedback' })).toBeVisible();
  await expect(dialog.getByRole('img', { name: 'Share card preview' })).toBeVisible();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  const response = await page.request.get(`/api/feedback?campaign_id=${campaignID}`);
  const before = await response.json();
  const downloadEvent = page.waitForEvent('download');
  await dialog.getByRole('link', { name: 'Download image', exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/feedback.*\.png$/);
  const after = await page.request.get(`/api/feedback?campaign_id=${campaignID}`);
  expect(await after.json()).toEqual(before);
  await download.saveAs(test.info().outputPath('feedback-card.png'));
});

test('copy link uses the public URL and image text cannot be edited', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(`/c/${campaignID}`);
  await page.getByRole('button', { name: 'Share feedback', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Copy link', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    `${baseURL}/f/c/${campaignID}`,
  );
  await expect(dialog.getByText('Edit image text', { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('textbox', { name: 'Text on image' })).toHaveCount(0);
});

for (const width of [1440, 390, 320]) {
  test(`dashboard and sign-in stay usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/c');
    await expect(page.getByRole('heading', { name: 'Your campaigns', exact: true })).toBeVisible();
    await expect(page.getByLabel('Campaign name', { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Your campaigns', exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /Hear what people think/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Sign in with Google/ })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

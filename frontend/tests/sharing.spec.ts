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
    await page.goto(`/c/${campaignID}`);
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
        return {
          qr: Array.from(context.getImageData(30, 690, 180, 180).data),
        };
      }, png.toString('base64'));
      expect(jsQR(new Uint8ClampedArray(pixels.qr), 180, 180)?.data).toBe(
        `${baseURL}/f/c/${campaignID}`,
      );

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

test('uploaded stamp is cropped locally and restored after reload', async ({ page }) => {
  await page.goto(`/c/${campaignID}`);
  // A real raster file generated in the browser: red left half, blue right half.
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 800; canvas.height = 200;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 400, 200);
    ctx.fillStyle = '#0000ff'; ctx.fillRect(400, 0, 400, 200);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const uploads: string[] = [];
  page.on('request', request => {
    if (request.frame() === page.mainFrame() && ['POST', 'PUT', 'PATCH'].includes(request.method())) uploads.push(request.url());
  });
  await page.getByRole('button', { name: 'Share campaign', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Stamp image', { exact: true }).setInputFiles({
    name: 'stamp.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64'),
  });
  const horizontal = dialog.getByRole('slider', { name: 'Horizontal position', exact: true });
  await horizontal.focus();
  await page.keyboard.press('Home');
  await dialog.getByRole('button', { name: 'Apply stamp', exact: true }).click();
  await expect(dialog.getByText('Image saved on this device.', { exact: true })).toBeVisible();
  const stampPixel = () => dialog.getByRole('img', { name: 'Share card preview' }).evaluate(async (element) => {
    const image = element as HTMLImageElement;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    return Array.from(ctx.getImageData(825, 1190, 1, 1).data);
  });
  await expect.poll(stampPixel).toEqual([255, 0, 0, 255]);
  await page.reload();
  await page.getByRole('button', { name: 'Share campaign', exact: true }).click();
  await expect(dialog.getByText('Image saved on this device.', { exact: true })).toBeVisible();
  await expect.poll(stampPixel).toEqual([255, 0, 0, 255]);
  await dialog.getByRole('button', { name: 'Remove stamp', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Remove stamp', exact: true })).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Share campaign', exact: true }).click();
  await expect(dialog.getByRole('img', { name: 'Share card preview' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Remove stamp', exact: true })).toHaveCount(0);
  expect(uploads).toEqual([]);
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

test('invalid stamps and unavailable local storage do not prevent downloading', async ({ page }) => {
  // Fault injection: real app and API, but browser storage is unavailable.
  await page.addInitScript(() => {
    indexedDB.open = () => { throw new Error('Storage unavailable'); };
  });
  await page.goto(`/c/${campaignID}`);
  await page.getByRole('button', { name: 'Share campaign', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Local storage is unavailable.', { exact: false })).toBeVisible();
  await dialog.getByLabel('Stamp image', { exact: true }).setInputFiles({
    name: 'invalid.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg />'),
  });
  await expect(dialog.getByRole('alert')).toContainText('up to 10 MB');
  await dialog.getByLabel('Stamp image', { exact: true }).setInputFiles({
    name: 'corrupt.png', mimeType: 'image/png', buffer: Buffer.from('not an image'),
  });
  await expect(dialog.getByRole('alert')).toBeVisible();
  const download = page.waitForEvent('download');
  await dialog.getByRole('link', { name: 'Download image', exact: true }).click();
  const png = await readFile((await (await download).path())!);
  expect(png.readUInt32BE(16)).toBe(1080);
  expect(png.readUInt32BE(20)).toBe(1920);
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

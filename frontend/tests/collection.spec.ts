import { expect, test } from '@playwright/test';

const campaignID = process.env.TBT_TEST_CAMPAIGN_ID;
test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000' });

for (const width of [1440, 768, 390, 320]) {
  test(`content and feedback remain usable at ${width}px`, async ({ page }) => {
    test.skip(!campaignID, 'Set TBT_TEST_CAMPAIGN_ID to a campaign with content.');
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/f/c/${campaignID}`);
    const feedback = page.getByRole('textbox', { name: 'Feedback', exact: true });
    await expect(feedback).toBeVisible();
    await feedback.fill('Keep this draft while viewing the content.');
    const preview = page.getByRole('region', { name: 'Campaign content' });
    if (width < 1024) {
      const toggle = page.getByRole('button', { name: /View content/ });
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(preview).not.toBeVisible();
      await toggle.click();
      await expect(page.getByRole('button', { name: /Hide content/ })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      await expect(preview).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
      await page.getByRole('button', { name: /Hide content/ }).click();
      await expect(preview).not.toBeVisible();
      await expect(feedback).toHaveValue('Keep this draft while viewing the content.');
    } else {
      await expect(preview).toBeVisible();
      const contentBox = await preview.boundingBox();
      const formBox = await feedback.boundingBox();
      expect(contentBox!.x + contentBox!.width).toBeLessThan(formBox!.x);
    }
    // Provider scripts briefly stage an iframe before moving it into the container.
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    if (width >= 1024)
      await expect(page.getByRole('link', { name: /Open original on/ })).toBeVisible();
  });
}

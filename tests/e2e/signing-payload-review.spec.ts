import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signingAccount } from '../__factories__/signingPayloads';

test.beforeEach(async ({ page }) => {
  // No Horizon/RPC/provider calls are permitted by this synthetic fixture.
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === 'localhost' ||
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort()
  );
  await page.goto('/tests/e2e/fixtures/signing-payload-review.html');
});

for (const kind of ['transaction', 'fee-bump', 'authorization', 'message']) {
  test(`reviews ${kind} before invoking signing`, async ({ page }) => {
    await page.getByRole('button', { name: `Review ${kind}`, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(signingAccount.publicKey(), { exact: true }).first()
    ).toBeVisible();
    if (kind === 'authorization') {
      await expect(dialog.getByText('transfer', { exact: true })).toBeVisible();
      await expect(dialog.getByText('approve', { exact: true })).toBeVisible();
      await expect(dialog.getByText('9007199254740993', { exact: true }).first()).toBeVisible();
    } else if (kind === 'message') {
      await expect(
        dialog.getByText('Log in to dashboard.example\\u000aNo funds are transferred.', {
          exact: true,
        })
      ).toBeVisible();
    } else {
      await expect(dialog.getByText('900719925.1234567', { exact: true })).toBeVisible();
    }
    await expect(page.getByTestId('signature-count')).toHaveText('0');
    const approve = dialog.getByRole('button', { name: 'Approve and open wallet' });
    await expect(approve).toBeDisabled();
    expect(
      (
        await new AxeBuilder({ page })
          .include('[role="dialog"]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations
    ).toEqual([]);
    await dialog.getByRole('checkbox').check();
    await approve.click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('signature-count')).toHaveText('1');
    await expect(page.getByRole('status')).toHaveText('Signed');
  });
}

test('Escape cancels, restores focus and permits retry', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Review transaction', exact: true });
  await trigger.focus();
  await trigger.press('Enter');
  await expect(page.getByRole('button', { name: 'Cancel signing' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.getByTestId('signature-count')).toHaveText('0');
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel signing' }).click();
});

test('changed context blocks an approved request', async ({ page }) => {
  await page.getByRole('button', { name: 'Review authorization', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('invalidate-signing-fixture')));
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Approve and open wallet' }).click();
  await expect(page.getByRole('status')).toContainText('changed');
  await expect(page.getByTestId('signature-count')).toHaveText('0');
});

test('invalid payload fails without opening review or signing', async ({ page }) => {
  await page.getByRole('button', { name: 'Review invalid', exact: true }).click();
  await expect(page.getByRole('status')).not.toHaveText('Ready');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('signature-count')).toHaveText('0');
});

test('review fits a narrow screen and keeps keyboard focus inside', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.getByRole('button', { name: 'Review message', exact: true }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Approve and open wallet' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Signing payload details')).toBeFocused();
  expect(
    await page.getByRole('dialog').evaluate((node) => node.scrollWidth <= node.clientWidth)
  ).toBe(true);
  await page.keyboard.press('Escape');
});

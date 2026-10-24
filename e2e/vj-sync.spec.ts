import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("one button opens synchronized visuals; dragging or closing the DJ preview keeps projection running", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const bytes = await readFile("e2e/fixtures/vj.webm");
  await page.locator("#library-toggle-btn").click();
  await page.locator('input[accept="audio/*,video/*"]').setInputFiles([
    { name: "First.webm", mimeType: "video/webm", buffer: Buffer.from(bytes) },
    { name: "Second.webm", mimeType: "video/webm", buffer: Buffer.from(bytes) },
  ]);
  await expect(page.getByRole("status", { name: "Import results" })).toContainText("2 videos");
  await page.getByRole("button", { name: "Close library", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open visuals", exact: true })).toHaveCount(1);
  const opened = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Open visuals", exact: true }).click();
  const projector = await opened;
  const preview = page.getByRole("region", { name: "DJ video preview" });
  await expect(preview).toBeVisible();
  expect((await preview.boundingBox())!.width).toBeLessThanOrEqual(280);
  await expect(projector.getByText("SECOND", { exact: true })).toBeVisible();
  await expect.poll(() => projector.locator("video").evaluate((video: HTMLVideoElement) => video.readyState)).toBeGreaterThanOrEqual(2);
  const master = preview.locator("video");
  await expect.poll(() => master.evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThan(0.4);
  const pausedAt = await master.evaluate((video: HTMLVideoElement) => { video.pause(); return video.currentTime; });
  await expect.poll(() => projector.locator("video").evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
  await expect.poll(() => projector.locator("video").evaluate((video: HTMLVideoElement) => video.currentTime)).toBeCloseTo(pausedAt, 1);
  await master.evaluate((video: HTMLVideoElement) => video.play());
  await expect.poll(() => projector.locator("video").evaluate((video: HTMLVideoElement) => video.paused)).toBe(false);
  const before = (await preview.boundingBox())!;
  const handle = preview.getByRole("button", { name: "Move DJ preview" });
  const bounds = (await handle.boundingBox())!;
  await page.mouse.move(bounds.x + 40, bounds.y + 12); await page.mouse.down();
  await page.mouse.move(bounds.x - 160, bounds.y - 88, { steps: 10 }); await page.mouse.up();
  expect((await preview.boundingBox())!.x).toBeLessThan(before.x - 100);
  await preview.getByRole("button", { name: "Close DJ preview" }).click();
  await expect(preview).not.toBeVisible();
  expect(projector.isClosed()).toBe(false);
  await expect.poll(() => projector.locator("video").evaluate((video: HTMLVideoElement) => !video.paused && video.readyState >= 2)).toBe(true);
  await page.locator("#library-toggle-btn").click();
  await page.locator(".library-grid").getByText("FIRST", { exact: true }).click();
  await expect(projector.getByText("FIRST", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close library", exact: true }).click();
  const windows = page.context().pages().length;
  await page.getByRole("button", { name: "Open visuals", exact: true }).click();
  await expect(preview).toBeVisible();
  expect(page.context().pages()).toHaveLength(windows);
  await expect(preview.getByText("FIRST", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/vj-preview.png" });
  for (const size of [{ width: 390, height: 844 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(size);
    await expect.poll(async () => {
      const bounds = (await preview.boundingBox())!;
      return bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= size.width && bounds.y + bounds.height <= size.height;
    }).toBe(true);
  }
  await projector.close();
});

test("blocked projection popups leave a usable preview and explain how to enable projection", async ({ page }) => {
  await page.addInitScript(() => { window.open = () => null; });
  await page.goto("/");
  await page.getByRole("button", { name: "Open visuals", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Allow pop-ups" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close DJ preview" })).toBeInViewport();
});

import { test, expect } from "@playwright/test";

function audioFixture() {
  const bytes = Buffer.alloc(44 + 16000);
  bytes.write("RIFF"); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36); bytes.writeUInt32LE(16000, 40);
  return bytes;
}

test("library overlays the console, snaps and returns focus on close", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const trigger = page.locator("#library-toggle-btn");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  const before = await page.locator(".console-main").boundingBox();
  await trigger.click();
  const drawer = page.getByRole("dialog", { name: "Media library" });
  await expect(drawer).toBeVisible();
  await expect(page.locator(".console-main")).toHaveJSProperty("clientHeight", Math.round(before!.height));
  await expect.poll(async () => (await drawer.boundingBox())!.y).toBeCloseTo(450, 0);
  await expect(drawer.getByRole("button", { name: /Height/ })).toHaveCount(0);
  const handle = drawer.getByRole("button", { name: "Close library", exact: true });
  await expect(handle).toHaveCSS("cursor", "grab");
  const bounds=(await handle.boundingBox())!;
  await page.mouse.move(bounds.x+bounds.width/2,bounds.y+12);await page.mouse.down();
  await page.mouse.move(bounds.x+bounds.width/2,bounds.y+164,{steps:12});await page.mouse.up();
  await expect(drawer).not.toBeVisible();await expect(trigger).toBeFocused();
  await trigger.click();await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

for (const size of [{ width: 844, height: 390 }, { width: 667, height: 375 }, { width: 1024, height: 768 }]) {
  test(`both decks fit at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await expect(page.locator(".console-slot:visible")).toHaveCount(3);
    for (const id of ["A", "B"]) {
      await expect(page.locator(`#play-btn-${id}`)).toBeInViewport();
      await expect(page.locator(`#console-panel-${id} .pad-btn`).last()).toBeInViewport();
      const clipped = await page.locator(`#console-panel-${id} .deck-body`).evaluate(element => {
        const bounds = element.getBoundingClientRect();
        return [...element.querySelectorAll(".deck-jog, .deck-eqgroup, .deck-tempo")].some(child => {
          const r = child.getBoundingClientRect();
          return r.left < bounds.left - 1 || r.right > bounds.right + 1 || r.top < bounds.top - 1 || r.bottom > bounds.bottom + 1;
        });
      });
      expect(clipped).toBe(false);
      const deck = page.locator(`#console-panel-${id} .deck-panel`);
      expect(await deck.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(2);
    }
    await expect(page.locator(".mixer-center-panel").getByRole("button", { name: "CUE B", exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/landscape-${size.width}.png` });
  });
}

for (const size of [{ width: 320, height: 640 }, { width: 667, height: 375 }]) {
  test(`music selection and video tab stay reachable at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await page.locator("#library-toggle-btn").click();
    const dialog = page.getByRole("dialog", { name: "Media library" });
    await dialog.locator('input[accept="audio/*,video/*"]').setInputFiles(Array.from({ length: 20 }, (_, i) => ({
      name: `Canción ${String(i).padStart(2, "0")} con título largo.wav`, mimeType: "audio/wav", buffer: audioFixture(),
    })));
    await expect(dialog.locator(".library-song-row")).toHaveCount(20, { timeout: 20000 });
    await expect(dialog.getByText("Processing Media", { exact: true })).not.toBeVisible();
    await expect(dialog.getByTitle("Load to Deck A", { exact: true }).first()).toBeInViewport();
    await expect(dialog.getByTitle("Load to Deck B", { exact: true }).first()).toBeInViewport();
    await dialog.getByTitle("Load to Deck B", { exact: true }).last().scrollIntoViewIfNeeded();
    await expect(dialog.getByTitle("Load to Deck B", { exact: true }).last()).toBeInViewport();
    await dialog.getByLabel("Search music").fill("Canción 19");
    await expect(dialog.locator(".library-song-row")).toHaveCount(1);
    await expect(dialog.getByTitle("Load to Deck B", { exact: true })).toBeInViewport();
    await page.screenshot({ path: `test-results/drawer-selection-${size.width}.png` });
    await dialog.getByRole("button", { name: /VJ VIDEO/ }).click();
    await expect(dialog.getByRole("button", { name: "Import files", exact: true })).toBeInViewport();
    await dialog.getByRole("button", { name: /MUSIC/ }).click();
    await dialog.getByTitle("Load to Deck B", { exact: true }).click();
    await expect(page.locator("#console-panel-B .deck-track-info")).toContainText("Canción 19");
    await dialog.getByRole("button", { name: "Close library", exact: true }).click();
    await page.setViewportSize({ width: 667, height: 375 });
    await expect(page.locator(".console-slot:visible")).toHaveCount(3);
    await expect(page.locator("#console-panel-B .deck-track-info")).toBeVisible();
  });
}

test("touch landscape keeps faders inside both decks", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 667, height: 375 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator(".console-slot:visible")).toHaveCount(3);
  for (const id of ["A", "B"]) {
    const deck = page.locator(`#console-panel-${id} .deck-panel`);
    await expect(page.locator(`#play-btn-${id}`)).toBeInViewport();
    await expect(deck.locator(".pad-btn").last()).toBeInViewport();
    await expect.poll(() => deck.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      return [...element.querySelectorAll('[role="slider"]')].every(slider => {
        const r = slider.getBoundingClientRect();
        return r.width >= 24 && r.left >= bounds.left && r.right <= bounds.right;
      });
    })).toBe(true);
  }
  await page.screenshot({ path: "test-results/landscape-touch-667.png" });
  await context.close();
});

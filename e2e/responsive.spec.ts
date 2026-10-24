import { test, expect } from "@playwright/test";

for (const size of [
  { width: 1920, height: 920 }, { width: 1440, height: 900 }, { width: 1280, height: 720 },
  { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 },
  { width: 320, height: 640 }, { width: 844, height: 390 },
]) {
  test("console layout and reachable controls " + size.width + "x" + size.height, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    const tabbed = size.width < 1024 && size.height > size.width;
    await expect(page.locator(".console-slot:visible")).toHaveCount(tabbed ? 1 : 3);
    await page.screenshot({ animations: "disabled", path: "test-results/console-" + size.width + "x" + size.height + ".png" });
    if (tabbed) {
      await expect(page.locator("#settings-btn")).toBeInViewport();
      await page.getByRole("tab", { name: "DECK A", exact: true }).focus();
      await page.keyboard.press("ArrowRight");
      await expect(page.getByRole("tab", { name: "MIXER", exact: true })).toBeFocused();
      await page.getByRole("tab", { name: "DECK B", exact: true }).click();
      await expect(page.locator("#console-panel-B")).toBeVisible();
      await page.getByRole("tab", { name: "MIXER", exact: true }).click();
      await page.locator(".mixer-center-panel").getByRole("button", { name: "CUE B", exact: true }).scrollIntoViewIfNeeded();
      await expect(page.locator(".mixer-center-panel").getByRole("button", { name: "CUE B", exact: true })).toBeInViewport();
      await page.getByRole("tab", { name: "DECK A", exact: true }).click();
    }
    const deck = page.locator("#console-panel-A .deck-panel");
    const dimensions = await deck.evaluate(element => {
      const panel = element.getBoundingClientRect();
      const slot = element.parentElement!.getBoundingClientRect();
      const rails = Array.from(element.querySelectorAll('[role="slider"]')).map(rail => {
        const rect = rail.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width };
      });
      const jog = element.querySelector(".deck-jog")!.getBoundingClientRect();
      const eq = element.querySelector(".deck-eqgroup")!.getBoundingClientRect();
      return { width: panel.width, slotWidth: slot.width, left: panel.left, right: panel.right, rails, jog: { x: jog.x, y: jog.y, right: jog.right, bottom: jog.bottom }, eq: { x: eq.x, y: eq.y, right: eq.right, bottom: eq.bottom }, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth };
    });
    expect(Math.abs(dimensions.width - dimensions.slotWidth)).toBeLessThanOrEqual(2);
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 2);
    for (const rail of dimensions.rails) {
      expect(rail.left).toBeGreaterThanOrEqual(dimensions.left);
      expect(rail.right).toBeLessThanOrEqual(dimensions.right);
      expect(rail.width).toBeGreaterThanOrEqual(22);
    }
    const overlapX = Math.min(dimensions.jog.right, dimensions.eq.right) - Math.max(dimensions.jog.x, dimensions.eq.x);
    const overlapY = Math.min(dimensions.jog.bottom, dimensions.eq.bottom) - Math.max(dimensions.jog.y, dimensions.eq.y);
    expect(overlapX <= 0 || overlapY <= 0).toBe(true);
    if (size.height >= 600) await expect(page.locator("#play-btn-A")).toBeInViewport();
    await page.locator("#play-btn-A").scrollIntoViewIfNeeded();
    await expect(page.locator("#play-btn-A")).toBeInViewport();
    await deck.locator(".pad-btn").last().scrollIntoViewIfNeeded();
    await expect(deck.locator(".pad-btn").last()).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (await page.locator("#library-toggle-btn").getAttribute("aria-expanded") === "false") await page.locator("#library-toggle-btn").click();
    await page.locator("#library-bottom-panel").scrollIntoViewIfNeeded();
    await expect(page.locator("#library-bottom-panel")).toBeInViewport();
    await page.screenshot({ animations: "disabled", path: "test-results/library-" + size.width + "x" + size.height + ".png" });
  });
}

test("320px touch screen keeps all channel sliders inside the deck", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto("/");
  const deck = page.locator("#console-panel-A .deck-panel");
  const spill = await deck.evaluate(element => element.scrollWidth - element.clientWidth);
  expect(spill).toBeLessThanOrEqual(2);
  await page.locator("#play-btn-A").scrollIntoViewIfNeeded();
  await expect(page.locator("#play-btn-A")).toBeInViewport();
  await page.screenshot({ animations: "disabled", path: "test-results/console-touch-320.png" });
  await context.close();
});

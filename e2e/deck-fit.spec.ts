import { test, expect } from "@playwright/test";

test("desktop decks fit all instruments after shrinking with the library open", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 920 }); await page.goto("/");
  if (await page.locator("#library-toggle-btn").getAttribute("aria-expanded") === "true") await page.locator("#library-toggle-btn").click();
  await page.locator("#library-toggle-btn").click();
  for (const size of [{ width: 1920, height: 920 }, { width: 1500, height: 820 }, { width: 1366, height: 768 }, { width: 1280, height: 650 }]) {
    await page.setViewportSize(size);
    await expect(page.locator("#library-toggle-btn")).toHaveAttribute("aria-expanded", "true");
    for (const id of ["A", "B"]) {
      const body = page.locator(`#console-panel-${id} .deck-body`);
      await expect.poll(() => body.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        return { scroll: element.scrollHeight > element.clientHeight + 2,
          clipped: [...element.querySelectorAll(".deck-jog, .deck-eqgroup, .deck-tempo")].some(child => { const rect = child.getBoundingClientRect(); return rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1; }) };
      })).toEqual({ scroll: false, clipped: false });
    }
    await page.screenshot({ animations: "disabled", path: `test-results/deck-fit-${size.width}.png`, fullPage: true });
  }
});

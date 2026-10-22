import { test, expect } from "@playwright/test";

for (const size of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }, { width: 844, height: 390 }]) {
  test("console and audio settings at " + size.width + "x" + size.height, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await expect(page.locator("header")).toContainText("AutoParty");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    await page.locator("#settings-btn").click();
    await page.getByRole("button", { name: "Audio & Mezclador" }).click();
    await expect(page.getByLabel("Auriculares / CUE")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Booth", exact: true })).toBeVisible();
    await expect(page.getByLabel("Auriculares / CUE")).toHaveValue("");
    await page.getByRole("button", { name: "Lineal", exact: true }).click();
    await page.screenshot({ path: "test-results/settings-" + size.width + ".png" });
  });
}

test("two touch pointers move separate controls independently and cancel cleanly", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const sliders = page.getByRole("slider");
  await expect(sliders.first()).toBeVisible();
  // Ignore pointer capture here to dispatch deterministic independent DOM streams.
  await page.evaluate(() => { Element.prototype.setPointerCapture = () => {}; });
  const first = sliders.nth(0), second = sliders.nth(1);
  const initial = await first.getAttribute("aria-valuenow");
  await first.dispatchEvent("pointerdown", { pointerId: 11, pointerType: "touch", button: 0, clientY: 200 });
  await second.dispatchEvent("pointerdown", { pointerId: 22, pointerType: "touch", button: 0, clientY: 200 });
  await second.dispatchEvent("pointermove", { pointerId: 22, pointerType: "touch", clientY: 180 });
  await expect(first).toHaveAttribute("aria-valuenow", initial!);
  await first.dispatchEvent("pointercancel", { pointerId: 11 });
  await first.dispatchEvent("pointermove", { pointerId: 11, clientY: 100 });
  await expect(first).toHaveAttribute("aria-valuenow", initial!);
  await second.dispatchEvent("pointerup", { pointerId: 22 });
});

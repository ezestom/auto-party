import { test, expect } from "@playwright/test";

for (const size of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 1024, height: 768 },
  { width: 390, height: 844 }, { width: 320, height: 640 }, { width: 844, height: 390 }, { width: 667, height: 375 }]) {
  test(`settings keep one size across sections at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await page.locator("#settings-btn").click();
    const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
    const initial = (await dialog.boundingBox())!;
    for (const section of ["General", "Audio", "Auto-DJ", "Help"]) {
      await dialog.getByRole("tab", { name: section, exact: true }).click();
      const bounds = (await dialog.boundingBox())!;
      expect(Math.abs(bounds.height - initial.height)).toBeLessThan(1);
      expect(Math.abs(bounds.width - initial.width)).toBeLessThan(1);
      expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(size.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(size.height);
      await expect(dialog.getByRole("button", { name: "Done", exact: true })).toBeInViewport();
      const body = dialog.getByRole("tabpanel");
      expect(await body.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      if ([1440, 320, 844].includes(size.width)) await page.screenshot({ path: `test-results/settings-${size.width}-${section}.png` });
    }
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(page.locator("#settings-btn")).toBeFocused();
  });
}

test("settings save preferences, reset without closing, and support keyboard navigation", async ({ page }) => {
  await page.goto("/"); await page.locator("#settings-btn").click();
  let dialog = page.getByRole("dialog", { name: "Settings", exact: true });
  await expect(dialog.getByRole("switch")).toHaveCount(3);
  await dialog.getByRole("switch", { name: "Play immediately after loading", exact: true }).check();
  await page.reload(); await page.locator("#settings-btn").click();
  dialog = page.getByRole("dialog", { name: "Settings", exact: true });
  await expect(dialog.getByRole("switch", { name: "Play immediately after loading", exact: true })).toBeChecked();
  await dialog.getByRole("button", { name: "Reset preferences", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("switch", { name: "Play immediately after loading", exact: true })).not.toBeChecked();
  await expect(dialog.getByRole("switch", { name: "Protect playing decks", exact: true })).toBeChecked();
  await expect(dialog.getByRole("switch", { name: "Keep volume consistent", exact: true })).toBeChecked();
  await dialog.getByRole("tab", { name: "General", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("tab", { name: "Audio", exact: true })).toBeFocused();
  await expect(dialog.getByRole("tab", { name: "Audio", exact: true })).toHaveAttribute("aria-selected", "true");
  await dialog.locator("summary").click();
  await expect(dialog.getByRole("combobox", { name: "Headphones / CUE", exact: true })).toBeVisible();
  await dialog.getByRole("tab", { name: "Auto-DJ", exact: true }).click();
  await dialog.getByRole("combobox", { name: "Transition length" }).selectOption("16");
  await expect(dialog.getByRole("combobox", { name: "Transition length" })).toHaveValue("16");
  await dialog.getByRole("button", { name: "Reset preferences", exact: true }).click();
  await expect(dialog.getByRole("tab", { name: "Auto-DJ", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(dialog.getByRole("combobox", { name: "Transition length" })).toHaveValue("8");
  await expect(dialog.getByText(/Voicebox|Recording format|Crossfader curve/i)).toHaveCount(0);
  await dialog.getByRole("button", { name: "Done", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close settings", exact: true })).toBeFocused();
});

test("unsupported browsers explain audio routing instead of showing unusable settings", async ({ page }) => {
  await page.addInitScript(() => { Reflect.deleteProperty(HTMLMediaElement.prototype, "setSinkId"); });
  await page.goto("/"); await page.locator("#settings-btn").click();
  const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
  await dialog.getByRole("tab", { name: "Audio", exact: true }).click(); await dialog.locator("summary").click();
  await expect(dialog.getByRole("status")).toContainText("does not support separate audio outputs");
  await expect(dialog.getByRole("combobox")).toHaveCount(0);
});

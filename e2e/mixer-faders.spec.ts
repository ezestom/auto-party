import { test, expect } from "@playwright/test";

test("mixer vertical faders use the available height for a useful travel distance", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  const mixer = page.locator(".mixer-center-panel");
  const rails = mixer.locator('[role="slider"][aria-orientation="vertical"]');
  await expect(rails).toHaveCount(4);
  await expect.poll(async () => rails.evaluateAll(elements => Math.min(...elements.map(element => element.getBoundingClientRect().height)))).toBeGreaterThanOrEqual(80);
  const master = mixer.getByRole("slider", { name: "Mst", exact: true });
  await master.focus(); await page.keyboard.press("Home");
  await expect(master).toHaveAttribute("aria-valuenow", "0");
  await page.keyboard.press("End");
  await expect(master).toHaveAttribute("aria-valuenow", "1");
  const metrics = await mixer.evaluate(element => ({ height: element.clientHeight, contentHeight: element.scrollHeight }));
  expect(metrics.contentHeight).toBeLessThanOrEqual(metrics.height + 2);
  await page.screenshot({ animations: "disabled", path: "test-results/mixer-long-faders.png" });
});

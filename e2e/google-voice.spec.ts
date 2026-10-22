import { test, expect } from "@playwright/test";
function wav() {
  const bytes = Buffer.alloc(44 + 8000 * 4 * 2);
  bytes.write("RIFF"); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVEfmt ", 8); bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22); bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36); bytes.writeUInt32LE(bytes.length - 44, 40);
  for (let i = 0; i < 32000; i++) bytes.writeInt16LE(Math.round(Math.sin(i * Math.PI * 2 * 220 / 8000) * 1000), 44 + i * 2);
  return bytes;
}
test("Google MC plays real browser audio, stops, caches the phrase and fits a phone", async ({ page }) => {
  let calls = 0;
  const unexpected: string[] = [];
  page.on("request", request => { if (/generativelanguage|127\.0\.0\.1:174|localhost:174/.test(request.url())) unexpected.push(request.url()); });
  await page.route("**/api/ai/status", route => route.fulfill({ json: { configured: true, authorized: true, model: "fixture" } }));
  await page.route("**/api/ai/speech", async route => {
    calls++;
    expect(route.request().postDataJSON()).toMatchObject({ voice: "Charon", style: "assistant" });
    await route.fulfill({ contentType: "audio/wav", body: wav() });
  });
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/");
  await page.getByRole("button", { name: "DJ MC", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "DJ MC · Voz de Google" });
  await modal.getByRole("button", { name: "Probar voz de Google", exact: true }).click();
  await expect(modal.getByRole("status")).toHaveText("Reproduciendo voz de Google…");
  await modal.getByRole("button", { name: "Detener anuncio" }).click();
  await expect(modal.getByRole("status")).toHaveText("Anuncio detenido.");
  await modal.getByRole("button", { name: "Probar voz de Google", exact: true }).click();
  await expect(modal.getByRole("status")).toHaveText("Anuncio reproducido con Google.", { timeout: 10000 });
  expect(calls).toBe(1); expect(unexpected).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/google-mc-phone.png", fullPage: true });
  await page.keyboard.press("Escape"); await expect(modal).not.toBeVisible();
});
test("failed Google voice displays the error without native speech fallback", async ({ page }) => {
  await page.addInitScript(() => { window.speechSynthesis.speak = () => { throw new Error("Native voice must not run"); }; });
  await page.route("**/api/ai/status", route => route.fulfill({ json: { configured: true, authorized: true, model: "fixture" } }));
  await page.route("**/api/ai/speech", route => route.fulfill({ status: 503, json: { error: { code: "PROVIDER_QUOTA" } } }));
  await page.goto("/"); await page.getByRole("button", { name: "DJ MC", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "DJ MC · Voz de Google" });
  await modal.getByRole("button", { name: "Probar voz de Google", exact: true }).click();
  await expect(modal.getByRole("status")).toContainText("Google no tiene cuota");
  await expect(modal.getByRole("button", { name: "Probar voz de Google", exact: true })).toBeEnabled();
});

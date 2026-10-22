import { expect, test, type Page } from "@playwright/test";

async function seedParty(page: Page) {
  await page.evaluate(async () => {
    const rate = 8000, samples = rate * 40, buffer = new ArrayBuffer(44 + samples * 2), view = new DataView(buffer);
    const text = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
    text(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true); text(8, "WAVEfmt "); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, samples * 2, true);
    for (let i = 0; i < samples; i++) view.setInt16(44 + i * 2, Math.round(600 * Math.sin(i * 2 * Math.PI * 220 / rate)), true);
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("MixrDatabase"); request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result, tx = database.transaction("tracks", "readwrite");
        for (const id of ["fixture-a", "fixture-b"]) tx.objectStore("tracks").put({ id, title: id, artist: "Fixture", bpm: 120, key: "—", duration: 40, color: "#ff6b00", audioData: buffer.slice(0), peaks: [0.1], detailPeaks: [0.1, 0.2], waveformVersion: 1 });
        tx.oncomplete = () => { database.close(); resolve(); }; tx.onerror = () => reject(tx.error);
      };
    });
  });
  await page.reload();
}
test("server endpoints require the access code and HttpOnly cookie before any AI request", async ({ request }) => {
  const origin = "http://localhost:3000";
  const status = await request.get("/api/ai/status");
  expect(await status.json()).toMatchObject({ configured: true, authorized: false });
  const denied = await request.post("/api/ai/test", { headers: { origin }, data: {} });
  expect(denied.status()).toBe(401);
  const other = await request.post("/api/ai/session", { headers: { origin: "https://other.example" }, data: { accessCode: "e2e-access-code-123456" } });
  expect(other.status()).toBe(403);
  const login = await request.post("/api/ai/session", { headers: { origin }, data: { accessCode: "e2e-access-code-123456" } });
  expect(login.status()).toBe(200);
  expect(login.headers()["set-cookie"]).toContain("HttpOnly");
  expect(await (await request.get("/api/ai/status")).json()).toMatchObject({ authorized: true });
  const invalid = await request.post("/api/ai/setlist", { headers: { origin }, data: { tracks: [] } });
  expect(invalid.status()).toBe(422);
  expect((await request.delete("/api/ai/session", { headers: { origin } })).status()).toBe(200);
});
test("connection panel tests Gemini without asking for a Google key and removes legacy storage", async ({ page }) => {
  let authorized = false;
  await page.addInitScript(() => localStorage.setItem("eze_mix_gemini_api_key", "deprecated-fixture-key"));
  await page.route("**/api/ai/status", route => route.fulfill({ json: { configured: true, authorized, model: "test-model" } }));
  await page.route("**/api/ai/session", async route => {
    expect(route.request().postDataJSON()).toEqual({ accessCode: "fixture-code" }); authorized = true;
    await route.fulfill({ json: { authorized: true } });
  });
  await page.route("**/api/ai/test", route => route.fulfill({ json: { connected: true, model: "test-model", checkedAt: new Date().toISOString() } }));
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/");
  await page.getByRole("button", { name: "Modo Fiesta", exact: true }).click();
  await page.getByRole("button", { name: "Ver conexión IA", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Conexión IA de la fiesta" });
  await expect(dialog.getByRole("status")).toContainText("IA requiere acceso");
  await dialog.getByLabel("Código de acceso", { exact: true }).fill("fixture-code");
  await dialog.getByRole("button", { name: "Conectar y probar", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("Gemini conectado");
  expect(await page.evaluate(() => localStorage.getItem("eze_mix_gemini_api_key"))).toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/ai-connection-phone.png", fullPage: true });
  await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible();
});
for (const source of ["gemini", "local"] as const) test("party mode accurately identifies " + source + " planning", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const direct: string[] = [];
  await page.route("https://generativelanguage.googleapis.com/**", route => { direct.push(route.request().url()); return route.abort(); });
  await page.route("**/api/ai/status", route => route.fulfill({ json: { configured: true, authorized: true, model: "test-model" } }));
  await page.route("**/api/ai/setlist", async route => {
    const body = route.request().postDataJSON();
    expect(Object.keys(body)).toEqual(["tracks"]);
    expect(body.tracks.every((track: object) => !Object.hasOwn(track, "audioData") && !Object.hasOwn(track, "peaks"))).toBe(true);
    await route.fulfill(source === "gemini" ? { json: { source: "gemini", model: "test-model", djComment: "Fiesta", setlist: [
      { trackId: "fixture-b", mixPoint: 16, transitionStyle: "smooth" }, { trackId: "fixture-a", mixPoint: 16, transitionStyle: "smooth" },
    ] } } : { status: 502, json: { error: { code: "PROVIDER_AUTH" } } });
  });
  await page.goto("/"); await expect(page.locator("#library-bottom-panel")).toBeVisible();
  await seedParty(page);
  await page.getByRole("button", { name: "Modo Fiesta", exact: true }).click();
  await page.getByRole("button", { name: "Iniciar fiesta", exact: true }).click();
  await expect(page.getByTestId("ai-plan-source")).toContainText(source === "gemini" ? "Gemini conectado · plan recibido" : "Automático local · orden por BPM");
  if (source === "local") await expect(page.getByText("Google rechazó la autenticación del servidor.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pausar fiesta", exact: true })).toBeVisible();
  expect(direct).toEqual([]);
  await page.screenshot({ path: "test-results/party-ai-" + source + ".png", fullPage: true });
  await page.getByRole("button", { name: "Pausar fiesta", exact: true }).click();
});

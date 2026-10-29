import { test, expect } from "@playwright/test";

test("the Auto-DJ glow follows running and paused states without stopping playback", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("https://generativelanguage.googleapis.com/**", route => route.abort());
  await page.goto("/");
  await expect(page.locator(".autodj-edge-glow")).toHaveAttribute("data-active", "false");
  await page.locator("#library-toggle-btn").click();
  await expect(page.locator("#library-bottom-panel")).toBeVisible();
  // Fresh isolated browser context; this never touches the user's music database.
  await page.evaluate(async () => {
    const sampleRate = 8000, samples = sampleRate * 40;
    const buffer = new ArrayBuffer(44 + samples * 2), view = new DataView(buffer);
    const text = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
    text(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true); text(8, "WAVE"); text(12, "fmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, samples * 2, true);
    for (let i = 0; i < samples; i++) view.setInt16(44 + i * 2, Math.round(Math.sin(i * 2 * Math.PI * 220 / sampleRate) * 600), true);
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("MixrDatabase");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("tracks", "readwrite");
        for (const id of ["safety-one", "safety-two"]) transaction.objectStore("tracks").put({
          id, title: id, artist: "Test fixture", bpm: id === "safety-one" ? 120 : 124, key: "—", duration: 40,
          color: "#ff6b00", audioData: buffer.slice(0), peaks: Array(800).fill(0.1),
        });
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => { database.close(); reject(transaction.error); };
      };
    });
  });
  await page.reload();
  await page.locator("#library-toggle-btn").click();
  await page.getByTitle("Load to Deck A", { exact: true }).first().click();
  await expect(page.locator("#play-btn-A")).toBeEnabled();
  // Loading is async; wait for the title to appear in both library and loaded deck.
  await expect(page.locator("main").getByText("safety-one", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Close library", exact: true }).click();
  await page.locator("#play-btn-A").click();
  await expect(page.locator("#play-btn-A")).toContainText("PAUSE");
  await page.locator("#settings-btn").click();
  await page.getByRole("tab", { name: "Auto-DJ", exact: true }).click();
  await page.getByRole("button", { name: "View AI connection", exact: true }).click();
  await page.getByRole("button", { name: "Use local Auto-DJ", exact: true }).click();
  await page.locator("#ai-autodj-btn").click();
  await expect(page.locator("#ai-autodj-btn")).toContainText("AUTO LOCAL");
  await expect(page.locator(".autodj-edge-glow")).toHaveAttribute("data-active", "true");
  await expect(page.locator("#play-btn-A")).toContainText("PAUSE");
  await page.locator("#ai-autodj-btn").click();
  await expect(page.locator("#ai-autodj-btn")).toContainText("AUTO PAUSED");
  await expect(page.locator(".autodj-edge-glow")).toHaveAttribute("data-active", "false");
  await expect(page.locator("#play-btn-A")).toContainText("PAUSE");
});

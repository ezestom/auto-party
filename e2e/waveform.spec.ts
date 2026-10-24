import { test, expect } from "@playwright/test";

function stereoFixture() {
  const rate = 8000, length = rate * 12;
  const bytes = Buffer.alloc(44 + length * 4);
  bytes.write("RIFF", 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(2, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 4, 28); bytes.writeUInt16LE(4, 32); bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36); bytes.writeUInt32LE(length * 4, 40);
  // Only the right channel contains audio: silence elsewhere must remain silence.
  for (const time of [1, 1.31, 2.02, 3.1, 6.7, 11.99]) {
    for (let i = 0; i < 48; i++) {
      const sample = Math.round(time * rate) + i;
      if (sample < length) bytes.writeInt16LE(Math.round(24000 * Math.sin(i * Math.PI / 12)), 44 + sample * 4 + 2);
    }
  }
  return bytes;
}

test("imported stereo audio keeps detailed peaks, renders them and exposes BPM reanalysis", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.locator("#library-toggle-btn").click();
  await page.locator('input[type="file"][accept="audio/*,video/*"]').setInputFiles({
    name: "Stereo - Transients.wav", mimeType: "audio/wav", buffer: stereoFixture(),
  });
  await expect(page.getByText("Transients", { exact: true })).toBeVisible({ timeout: 20000 });
  const saved = await page.evaluate(() => new Promise<{ peaks: number[]; detailPeaks: number[]; waveformVersion: number }>((resolve, reject) => {
    const request = indexedDB.open("MixrDatabase");
    request.onsuccess = () => {
      const database = request.result;
      const read = database.transaction("tracks").objectStore("tracks").getAll();
      read.onsuccess = () => { database.close(); resolve(read.result[0]); };
      read.onerror = () => { database.close(); reject(read.error); };
    };
    request.onerror = () => reject(request.error);
  }));
  expect(saved.peaks).toHaveLength(800);
  expect(saved.detailPeaks).toHaveLength(1200);
  expect(saved.waveformVersion).toBe(1);
  expect(Math.max(...saved.detailPeaks.slice(98, 103))).toBeGreaterThan(0.6);
  expect(Math.max(...saved.detailPeaks.slice(200, 205))).toBeGreaterThan(0.6);
  expect(Math.max(...saved.detailPeaks.slice(400, 450))).toBeLessThan(0.00001);
  await page.getByTitle("Load to Deck A", { exact: true }).click();
  await page.getByRole("button", { name: "Close library", exact: true }).click();
  await expect(page.getByRole("img", { name: "Onda detallada del deck A", exact: true })).toHaveAttribute("data-peak-count", "1200");
  await expect(page.getByRole("img", { name: "Vista general del deck A", exact: true })).toHaveAttribute("data-peak-count", "800");
  await page.locator("#library-toggle-btn").click();
  await page.getByRole("button", { name: "Reanalyze BPM", exact: true }).click();
  await expect(page.getByRole("status", { name: "BPM analysis" })).toContainText("BPM estimates", { timeout: 20000 });
  await page.getByRole("button", { name: "Close library", exact: true }).click();
  await page.locator("#play-btn-A").click();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "test-results/waveform-stereo-detail.png", fullPage: true });
});

import { test, expect } from "@playwright/test";

function wav() {
  const bytes = Buffer.alloc(16044);
  bytes.write("RIFF"); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36); bytes.writeUInt32LE(16000, 40);
  return bytes;
}

test("one file picker imports audio and video and reports individual failures in English", async ({ page }) => {
  await page.goto("/");
  await page.locator("#library-toggle-btn").click();
  const dialog = page.getByRole("dialog", { name: "Media library" });
  await expect(dialog.locator('input[type="file"]')).toHaveCount(1);
  await expect(dialog.locator('input[webkitdirectory]')).toHaveCount(0);
  const chooser = page.waitForEvent("filechooser");
  await dialog.getByRole("button", { name: "Import files", exact: true }).click();
  await (await chooser).setFiles([
    { name: "Track.M4A", mimeType: "", buffer: wav() },
    { name: "Visual.WEBM", mimeType: "", buffer: Buffer.from("fixture") },
    { name: "Corrupt.m4a", mimeType: "audio/mp4", buffer: Buffer.from("not audio") },
    { name: "desktop.ini", mimeType: "", buffer: Buffer.from("metadata") },
  ]);
  const results = dialog.getByRole("status", { name: "Import results" });
  await expect(results).toContainText("Imported: 1 audio files and 1 videos.");
  await expect(results).toContainText("Skipped: 1 non-media files.");
  await expect(results).toContainText("Could not import: Corrupt.m4a");
  await expect(dialog.locator(".library-song-row")).toHaveCount(1);
});

test("the shared import button stays available in the mobile video tab", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator("#library-toggle-btn").click();
  const dialog = page.getByRole("dialog", { name: "Media library" });
  await dialog.getByRole("button", { name: /VJ VIDEO/ }).click();
  await expect(dialog.getByRole("button", { name: "Import files", exact: true })).toBeInViewport();
  await expect(dialog.getByRole("button", { name: /folder|carpeta|Import Video/i })).toHaveCount(0);
  await page.screenshot({ path: "test-results/library-brighter-mobile.png" });
});

test('audio imports belong to the selected theme and remain available in All music',async({page})=>{
 await page.goto('/');await page.locator('#library-toggle-btn').click();
 const library=page.getByRole('dialog',{name:'Media library',exact:true});
 await library.getByRole('button',{name:'New theme',exact:true}).click();
 await page.getByLabel('Theme name',{exact:true}).fill('Cumbia');
 await page.getByRole('button',{name:'Save theme',exact:true}).click();
 await library.locator('input[type=file]').setInputFiles({name:'Theme only.wav',mimeType:'audio/wav',buffer:wav()});
 await expect(library.getByRole('status',{name:'Import results',exact:true})).toContainText('Imported: 1 audio files');
 await expect(library.locator('.library-song-row')).toHaveCount(1);
 await library.getByRole('button',{name:'New theme',exact:true}).click();
 await page.getByLabel('Theme name',{exact:true}).fill('Rock');await page.getByRole('button',{name:'Save theme',exact:true}).click();
 await expect(library.locator('.library-song-row')).toHaveCount(0);
 await library.getByRole('tab',{name:'All music',exact:true}).click();await expect(library.locator('.library-song-row')).toHaveCount(1);
 await library.getByRole('tab',{name:'Cumbia',exact:true}).click();await expect(library.locator('.library-song-row')).toHaveCount(1);
});

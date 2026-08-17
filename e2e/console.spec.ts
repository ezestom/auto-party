import { test, expect } from "@playwright/test";

test.describe("MIXR DJ Console E2E Verification", () => {
  test.beforeEach(async ({ page }) => {
    // Open home page
    await page.goto("/");
  });

  test("should load Root Layout and display brand headers", async ({ page }) => {
    // Verify brand title is present
    await expect(page.locator("text=MIXR")).toBeVisible();
    await expect(page.locator("text=DJ CONSOLE v1.0")).toBeVisible();
  });

  test("should initialize/resume Web Audio context on user pointer down", async ({ page }) => {
    // Before click, audio status should say Suspended (default state)
    const statusText = page.locator("footer");
    await expect(statusText).toContainText("Audio Engine Suspended");

    // Click on the layout body to trigger gesture resume callback
    await page.click("body");

    // Expect the status to shift to Ready
    await expect(statusText).toContainText("Audio Engine Ready");
  });

  test("should toggle the library sidebar drawer and display import controls", async ({ page }) => {
    const libraryDrawer = page.locator("#library-drawer");
    
    // Panel starts closed/hidden (has class translate-x-full)
    await expect(libraryDrawer).toHaveClass(/translate-x-full/);

    // Click on Library Toggle Button in the header
    await page.click("#library-toggle-btn");

    // Panel should now be open and visible (has class translate-x-0)
    await expect(libraryDrawer).toHaveClass(/translate-x-0/);

    // Check that import buttons are rendered in the panel
    await expect(page.locator("text=Import Folder")).toBeVisible();
    await expect(page.locator("text=Import Files")).toBeVisible();

    // Close panel
    await page.click("#library-close-btn");
    await expect(libraryDrawer).toHaveClass(/translate-x-full/);
  });
});

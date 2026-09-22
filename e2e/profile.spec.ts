import { expect, test } from "@playwright/test";

import { USERS, uniqueSuffix } from "./test-data";
import { login } from "./support";

test.describe("profile", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("updates the name, keeps it after a reload and shows the role read-only", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByText("Meridian Recovery")).toBeVisible();

    // The role is displayed but cannot be edited from here.
    await expect(page.getByText("ORG ADMIN").first()).toBeVisible();
    await expect(page.getByRole("combobox")).toHaveCount(0);

    const newName = `Renamed Admin ${uniqueSuffix()}`;
    await page.locator("#profile-name").fill(newName);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(/updated|saved/i).first()).toBeVisible();

    await page.reload();
    await expect(page.locator("#profile-name")).toHaveValue(newName);

    // The session now reports the new name.
    await page.getByRole("button", { name: USERS.adminA.email }).click();
    await expect(page.getByText(newName)).toBeVisible();
  });

  test("an email already in use by another user is rejected", async ({ page }) => {
    await page.goto("/profile");
    const original = await page.locator("#profile-email").inputValue();

    await page.locator("#profile-email").fill(USERS.adminB.email);
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText(/exist|unique|already/i).first()).toBeVisible();
    await page.reload();
    await expect(page.locator("#profile-email")).toHaveValue(original);
  });
});

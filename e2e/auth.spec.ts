import { expect, test } from "@playwright/test";

import { PASSWORD, USERS } from "./test-data";
import { login, logout } from "./support";

test.describe("authentication", () => {
  test("an unauthenticated visitor is sent to the login page", async ({ page }) => {
    await page.goto("/customers");

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("invalid credentials are rejected without starting a session", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(USERS.adminA.email);
    await page.locator('input[type="password"]').fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText(/invalid/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("link", { name: "Customers", exact: true })).toHaveCount(0);

    const token = await page.evaluate(() => window.localStorage.getItem("ard.access_token"));
    expect(token).toBeNull();
  });

  test("valid credentials open the console and the session survives a reload", async ({ page }) => {
    await login(page);

    await page.reload();
    await expect(page.getByRole("link", { name: "Customers", exact: true })).toBeVisible();
    await expect(page.getByText(/welcome/i).first()).toBeVisible();
  });

  test("a forged token is discarded on the next request", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() =>
      window.localStorage.setItem("ard.access_token", "not.a.valid.jwt"),
    );
    await page.goto("/customers");

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("link", { name: "Customers", exact: true })).toHaveCount(0);

    const token = await page.evaluate(() => window.localStorage.getItem("ard.access_token"));
    expect(token).toBeNull();
  });

  test("signing out clears the session and blocks the console", async ({ page }) => {
    await login(page);
    await logout(page);

    const token = await page.evaluate(() => window.localStorage.getItem("ard.access_token"));
    expect(token).toBeNull();

    await page.goto("/customers");
    await expect(page).toHaveURL(/\/login/);
  });

  test("the wrong password never reveals whether the account exists", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("nobody.here@example.com");
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText(/invalid/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});

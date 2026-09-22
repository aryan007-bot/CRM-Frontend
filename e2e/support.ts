import { expect, type APIRequestContext, type Page } from "@playwright/test";

import { API_PORT, PASSWORD, USERS } from "./test-data";

export const API_URL = `http://127.0.0.1:${API_PORT}`;

/**
 * Signs in through the real login form and waits until the authenticated shell
 * is on screen.
 */
export async function login(
  page: Page,
  email: string = USERS.adminA.email,
  password: string = PASSWORD,
): Promise<void> {
  // The login page bounces an already-authenticated visitor to the console, so
  // switching accounts has to start by discarding the stored token.
  await page.goto("/login");
  await page.evaluate(() => window.localStorage.clear());
  await page.goto("/login");

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // `exact` keeps this to the sidebar link (the dashboard KPI cards are links
  // whose accessible name also mentions customers).
  await expect(page.getByRole("link", { name: "Customers", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
}

/** Signs out through the account menu in the console header. */
export async function logout(page: Page, email: string = USERS.adminA.email): Promise<void> {
  await page.getByRole("button", { name: email }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
}

/**
 * Obtains a bearer token straight from the public API so a spec can seed data
 * in bulk without clicking through the UI. Still a real HTTP call against the
 * real backend and database.
 */
export async function apiLogin(
  request: APIRequestContext,
  email: string = USERS.adminA.email,
  password: string = PASSWORD,
): Promise<string> {
  const response = await request.post(`${API_URL}/api/v1/auth/login`, {
    data: { email, password },
  });
  expect(response.ok(), `login for ${email} failed: ${response.status()}`).toBeTruthy();
  const body = (await response.json()) as { access_token: string };
  return body.access_token;
}

export function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** Uploads a fixture through the hidden file input on the imports screen. */
export async function uploadFixture(page: Page, absolutePath: string): Promise<void> {
  await page.goto("/imports");
  await page.locator('input[type="file"]').setInputFiles(absolutePath);
  await expect(page).toHaveURL(/\/imports\/[0-9a-f-]{36}/);
  await expect(page.getByText("Map columns")).toBeVisible();
}

/** Fills the import mapping selects with the columns of the shipped fixtures. */
export async function mapColumns(
  page: Page,
  mapping: Partial<Record<keyof typeof COLUMN_NAMES, string>>,
): Promise<void> {
  for (const [field, column] of Object.entries(mapping)) {
    await page.locator(`#map-${field}`).click();
    await page.getByRole("option", { name: column, exact: true }).click();
  }
}

/** Header names of `tests/fixtures/valid-recovery.{csv,xlsx}`. */
export const COLUMN_NAMES = {
  customer_name: "Customer Name",
  phone: "Phone Number",
  account_number: "Account Number",
  outstanding_amount: "Outstanding Amount",
  due_date: "Due Date",
  creditor_name: "Creditor Name",
  email: "Email",
} as const;

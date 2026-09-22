import { expect, test } from "@playwright/test";

import { USERS, randomPhone, uniqueSuffix } from "./test-data";
import { API_URL, apiLogin, authHeader, login } from "./support";

test.describe("customers", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("creates a customer with a server-normalized phone and persists it", async ({ page }) => {
    const suffix = uniqueSuffix();
    const name = `E2E Debtor ${suffix}`;

    await page.goto("/customers");
    await page.getByRole("button", { name: "New customer" }).first().click();

    await page.locator("#customer-name").fill(name);
    await page.locator("#customer-email").fill(`debtor.${suffix}@example.com`);
    await page.getByLabel("Phone number 1").fill("98765 43210");
    await page.getByRole("button", { name: "Create customer" }).click();

    const row = page.getByRole("row").filter({ hasText: name });
    await expect(row).toBeVisible();
    // The server normalizes Indian numbers to E.164.
    await expect(row).toContainText("+919876543210");

    await page.reload();
    await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();

    // Detail view renders the same record plus its accounts section.
    await page.getByRole("link", { name }).click();
    await expect(page).toHaveURL(/\/customers\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText("Phone numbers")).toBeVisible();
    await expect(page.getByText("+919876543210")).toBeVisible();
    await expect(page.getByText("Accounts", { exact: true }).first()).toBeVisible();
  });

  test("search filters the list and an unmatched search shows an empty state", async ({ page }) => {
    const suffix = uniqueSuffix();
    const name = `Searchable Debtor ${suffix}`;

    await page.goto("/customers");
    await page.getByRole("button", { name: "New customer" }).first().click();
    await page.locator("#customer-name").fill(name);
    await page.getByLabel("Phone number 1").fill(randomPhone());
    await page.getByRole("button", { name: "Create customer" }).click();
    await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();

    await page.getByLabel("Search customers").fill(suffix);
    await page.getByLabel("Search customers").press("Enter");

    await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "Rajesh Sharma" })).toHaveCount(0);

    await page.getByLabel("Search customers").fill("zzz-no-such-customer-zzz");
    await page.getByLabel("Search customers").press("Enter");

    await expect(page.getByText("No customers match")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
  });

  test("paginates the standard list envelope", async ({ page, request }) => {
    const suffix = uniqueSuffix();
    const token = await apiLogin(request);
    const prefix = `Page ${suffix}`;

    for (let index = 1; index <= 12; index += 1) {
      const response = await request.post(`${API_URL}/api/v1/customers`, {
        headers: authHeader(token),
        data: {
          name: `${prefix} ${String(index).padStart(2, "0")}`,
          phones: [{ phone: randomPhone(), phone_type: "mobile", is_primary: true }],
        },
      });
      expect(response.ok(), await response.text()).toBeTruthy();
    }

    await page.goto("/customers");
    await page.getByLabel("Search customers").fill(prefix);
    await page.getByLabel("Search customers").press("Enter");

    await expect(page.getByText("12 customers")).toBeVisible();

    await page.getByLabel("Rows per page").click();
    await page.getByRole("option", { name: "10 / page" }).click();

    await expect(page.getByText("Showing 1–10 of 12")).toBeVisible();
    await expect(page.getByText("Page 1 of 2")).toBeVisible();

    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.getByText("Showing 11–12 of 12")).toBeVisible();
    await expect(page.getByText("Page 2 of 2")).toBeVisible();

    await page.getByRole("button", { name: "Previous page" }).click();
    await expect(page.getByText("Showing 1–10 of 12")).toBeVisible();
  });

  test("a read-only role cannot create customers", async ({ page }) => {
    await login(page, USERS.viewerA.email);
    await page.goto("/customers");

    await expect(page.getByRole("button", { name: "New customer" })).toHaveCount(0);
    await expect(page.getByRole("table")).toBeVisible();
  });
});

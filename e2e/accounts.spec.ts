import { expect, test } from "@playwright/test";

import { randomPhone, uniqueSuffix } from "./test-data";
import { login } from "./support";

test.describe("accounts", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  /** Creates a customer and one account through the UI and returns both names. */
  async function createCustomerAndAccount(page: import("@playwright/test").Page) {
    const suffix = uniqueSuffix();
    const customerName = `Account Holder ${suffix}`;
    const accountNumber = `ACC-${suffix}`;

    await page.goto("/customers");
    await page.getByRole("button", { name: "New customer" }).first().click();
    await page.locator("#customer-name").fill(customerName);
    await page.getByLabel("Phone number 1").fill(randomPhone());
    await page.getByRole("button", { name: "Create customer" }).click();
    await expect(page.getByRole("row").filter({ hasText: customerName })).toBeVisible();

    await page.goto("/accounts");
    await page.getByRole("button", { name: "New account" }).first().click();
    await page.getByLabel("Search customers").fill(customerName);
    await page.getByRole("button", { name: new RegExp(customerName) }).click();
    await page.locator("#account-number").fill(accountNumber);
    await page.locator("#account-amount").fill("25000.50");
    await page.locator("#account-due-date").fill("2026-12-01");
    await page.getByRole("button", { name: "Create account" }).click();

    return { customerName, accountNumber };
  }

  test("creates an account, links it to its customer and survives a reload", async ({ page }) => {
    const { customerName, accountNumber } = await createCustomerAndAccount(page);

    const row = page.getByRole("row").filter({ hasText: accountNumber });
    await expect(row).toBeVisible();
    await expect(row).toContainText(customerName);
    // Exact money formatting — never floating point artefacts.
    await expect(row).toContainText("₹25,000.50");

    await page.reload();
    await expect(page.getByRole("row").filter({ hasText: accountNumber })).toBeVisible();

    await page.getByRole("link", { name: accountNumber }).click();
    await expect(page).toHaveURL(/\/accounts\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { name: accountNumber })).toBeVisible();
    await expect(page.getByText("Outstanding")).toBeVisible();
    await expect(page.getByText("₹25,000.50").first()).toBeVisible();
    await expect(page.getByText(customerName)).toBeVisible();
    await expect(page.getByText("Payment history")).toBeVisible();
  });

  test("filters by account number and by status", async ({ page }) => {
    const { accountNumber } = await createCustomerAndAccount(page);

    await page.goto("/accounts");
    await page.getByLabel("Search accounts").fill(accountNumber);
    await page.getByLabel("Search accounts").press("Enter");
    await expect(page.getByRole("row").filter({ hasText: accountNumber })).toBeVisible();

    await page.getByLabel("Search accounts").fill("zzz-no-such-account-zzz");
    await page.getByLabel("Search accounts").press("Enter");
    await expect(page.getByText("No accounts match")).toBeVisible();

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByRole("row").filter({ hasText: accountNumber })).toBeVisible();
  });

  test("records a payment and reduces the outstanding amount on the server", async ({ page }) => {
    const { accountNumber } = await createCustomerAndAccount(page);

    await page.goto("/accounts");
    await page.getByLabel("Search accounts").fill(accountNumber);
    await page.getByLabel("Search accounts").press("Enter");
    await page.getByRole("link", { name: accountNumber }).click();

    await expect(page.getByText("Record a payment")).toBeVisible();
    await page.locator("#payment-amount").fill("500.50");
    await page.getByRole("button", { name: "Record payment" }).click();

    // 25000.50 - 500.50, calculated with decimals on the backend.
    await expect(page.getByText("₹24,500.00").first()).toBeVisible();

    await page.reload();
    await expect(page.getByText("₹24,500.00").first()).toBeVisible();
    await expect(page.getByText("Payments recorded")).toBeVisible();
  });
});

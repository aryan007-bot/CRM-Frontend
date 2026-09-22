import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { FIXTURES } from "./test-data";
import {
  API_URL,
  COLUMN_NAMES,
  apiLogin,
  authHeader,
  login,
  mapColumns,
  uploadFixture,
} from "./support";

/** Import id from the current /imports/{id} URL. */
function currentImportId(page: Page): string {
  const match = /\/imports\/([0-9a-f-]{36})/.exec(page.url());
  if (!match) throw new Error(`No import id in URL: ${page.url()}`);
  return match[1];
}

async function importJob(request: APIRequestContext, token: string, importId: string) {
  const response = await request.get(`${API_URL}/api/v1/imports/${importId}`, {
    headers: authHeader(token),
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as {
    data: {
      status: string;
      total_rows: number;
      valid_rows: number;
      invalid_rows: number;
      duplicate_rows: number;
      imported_rows: number;
      detected_columns: string[];
    };
  };
}

async function validateAll(page: Page) {
  await page.getByRole("button", { name: "Validate" }).click();
  await expect(page.getByText("Validation result")).toBeVisible();
}

test.describe("imports", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("XLSX: map, validate and confirm creates customers and accounts", async ({
    page,
    request,
  }) => {
    const token = await apiLogin(request);

    await uploadFixture(page, FIXTURES.validXlsx);
    const importId = currentImportId(page);

    // Every fixture column is detected and offered for mapping.
    for (const column of Object.values(COLUMN_NAMES)) {
      await expect(page.getByText(column, { exact: false }).first()).toBeVisible();
    }

    await mapColumns(page, {
      customer_name: COLUMN_NAMES.customer_name,
      phone: COLUMN_NAMES.phone,
      account_number: COLUMN_NAMES.account_number,
      outstanding_amount: COLUMN_NAMES.outstanding_amount,
      due_date: COLUMN_NAMES.due_date,
      creditor_name: COLUMN_NAMES.creditor_name,
    });
    await validateAll(page);

    const validated = await importJob(request, token, importId);
    expect(validated.data.valid_rows).toBe(3);
    expect(validated.data.invalid_rows).toBe(0);
    expect(validated.data.duplicate_rows).toBe(0);

    await page.getByRole("button", { name: "Confirm import" }).click();
    await page.getByRole("button", { name: "Yes, import" }).click();

    await expect(page.getByText(/Imported 3 row\(s\)/)).toBeVisible();

    const confirmed = await importJob(request, token, importId);
    expect(confirmed.data.status).toBe("completed");
    expect(confirmed.data.imported_rows).toBe(3);

    // The imported portfolio is readable through the normal CRM screens.
    await page.goto("/customers");
    await page.getByLabel("Search customers").fill("Rajesh Sharma");
    await page.getByLabel("Search customers").press("Enter");
    const customerRow = page.getByRole("row").filter({ hasText: "Rajesh Sharma" });
    await expect(customerRow).toBeVisible();
    await expect(customerRow).toContainText("+919876543210");

    await page.goto("/accounts");
    await page.getByLabel("Search accounts").fill("ACC-1001");
    await page.getByLabel("Search accounts").press("Enter");
    const accountRow = page.getByRole("row").filter({ hasText: "ACC-1001" });
    await expect(accountRow).toBeVisible();
    await expect(accountRow).toContainText("Rajesh Sharma");
    await expect(accountRow).toContainText("₹45,000.00");
  });

  test("CSV: the same rows are reported as duplicates instead of being imported again", async ({
    page,
    request,
  }) => {
    const token = await apiLogin(request);

    await uploadFixture(page, FIXTURES.validCsv);
    const importId = currentImportId(page);

    await mapColumns(page, {
      customer_name: COLUMN_NAMES.customer_name,
      phone: COLUMN_NAMES.phone,
      account_number: COLUMN_NAMES.account_number,
      outstanding_amount: COLUMN_NAMES.outstanding_amount,
      creditor_name: COLUMN_NAMES.creditor_name,
    });
    await validateAll(page);

    // ACC-1001..ACC-1003 already exist in this organization: every row is a
    // duplicate, so nothing is importable and confirmation stays disabled.
    const validated = await importJob(request, token, importId);
    expect(validated.data.duplicate_rows).toBe(3);
    expect(validated.data.valid_rows).toBe(0);
    await expect(page.getByRole("button", { name: "Confirm import" })).toBeDisabled();

    await page.goto("/accounts");
    await page.getByLabel("Search accounts").fill("ACC-1001");
    await page.getByLabel("Search accounts").press("Enter");
    await expect(page.getByRole("row").filter({ hasText: "ACC-1001" })).toHaveCount(1);
  });

  test("a file with invalid rows cannot be confirmed", async ({ page, request }) => {
    const token = await apiLogin(request);

    await uploadFixture(page, FIXTURES.invalidCsv);
    const importId = currentImportId(page);

    await mapColumns(page, {
      customer_name: COLUMN_NAMES.customer_name,
      phone: COLUMN_NAMES.phone,
      account_number: COLUMN_NAMES.account_number,
      outstanding_amount: COLUMN_NAMES.outstanding_amount,
    });
    await validateAll(page);

    const validated = await importJob(request, token, importId);
    expect(validated.data.invalid_rows).toBeGreaterThan(0);
    expect(validated.data.valid_rows).toBe(0);

    // The problems are listed per row and confirmation is blocked.
    await expect(page.getByText("Problem")).toBeVisible();
    await expect(page.getByText(/must be fixed in the source file/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm import" })).toBeDisabled();

    // Nothing was written.
    await page.goto("/customers");
    await page.getByLabel("Search customers").fill("Bad Phone Debtor");
    await page.getByLabel("Search customers").press("Enter");
    await expect(page.getByText("No customers match")).toBeVisible();
  });

  test("duplicate rows inside one file are skipped and confirming twice is rejected", async ({
    page,
    request,
  }) => {
    const token = await apiLogin(request);

    await uploadFixture(page, FIXTURES.duplicateCsv);
    const importId = currentImportId(page);

    await mapColumns(page, {
      customer_name: COLUMN_NAMES.customer_name,
      phone: COLUMN_NAMES.phone,
      account_number: COLUMN_NAMES.account_number,
      outstanding_amount: COLUMN_NAMES.outstanding_amount,
    });
    await validateAll(page);

    // The fixture repeats ACC-3001: the first row is importable, the second is
    // flagged as a duplicate and is never written twice.
    const validated = await importJob(request, token, importId);
    expect(validated.data.duplicate_rows).toBeGreaterThan(0);
    expect(validated.data.valid_rows).toBe(1);
    expect(validated.data.valid_rows + validated.data.duplicate_rows).toBe(
      validated.data.total_rows,
    );

    await page.getByRole("button", { name: "Confirm import" }).click();
    await page.getByRole("button", { name: "Yes, import" }).click();
    await expect(page.getByText(/Imported 1 row\(s\)/)).toBeVisible();

    // The duplicate account exists exactly once.
    await page.goto("/accounts");
    await page.getByLabel("Search accounts").fill("ACC-3001");
    await page.getByLabel("Search accounts").press("Enter");
    await expect(page.getByRole("row").filter({ hasText: "ACC-3001" })).toHaveCount(1);
    await expect(page.getByText("1 accounts", { exact: false })).toBeVisible();

    // Confirming the same import a second time is rejected by the server.
    const replayed = await request.post(`${API_URL}/api/v1/imports/${importId}/confirm`, {
      headers: authHeader(token),
    });
    expect(replayed.status()).toBe(409);

    await page.goto(`/imports/${importId}`);
    await expect(page.getByRole("button", { name: "Confirm import" })).toHaveCount(0);
  });
});

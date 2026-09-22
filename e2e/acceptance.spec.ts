import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { STATE_DIR, uniqueSuffix } from "./test-data";
import { API_URL, authHeader, apiLogin, login, logout, mapColumns, uploadFixture } from "./support";

/**
 * The acceptance flow from the Phase 1 specification, driven entirely through
 * the browser against the real backend and database:
 *
 *   LOGIN → DASHBOARD → IMPORT → MAP → VALIDATE → CONFIRM → CUSTOMER CREATED →
 *   ACCOUNT CREATED → OPEN CUSTOMER → OPEN ACCOUNT → CREATE CAMPAIGN →
 *   ADD ACCOUNT TO CAMPAIGN → RELOAD (data still present) → DASHBOARD COUNT
 *   UPDATED → LOGOUT → LOGIN AGAIN (data still present)
 */
test("the full Phase 1 acceptance flow works through the browser", async ({ page, request }) => {
  const suffix = uniqueSuffix();
  const debtor = `Acceptance Debtor ${suffix}`;
  const account = `ACC-E2E-${suffix}`;
  const campaign = `Acceptance Campaign ${suffix}`;

  // A portfolio whose account numbers are unique to this run.
  mkdirSync(STATE_DIR, { recursive: true });
  const portfolio = path.join(STATE_DIR, `acceptance-${suffix}.csv`);
  writeFileSync(
    portfolio,
    [
      "Customer Name,Phone,Account Number,Outstanding,Due Date,Creditor",
      `${debtor},+91 98111 22334,${account},"₹32,500.25",2026-11-30,HDFC Bank`,
    ].join("\n"),
    "utf8",
  );

  // ---- LOGIN ---------------------------------------------------------------
  await login(page);

  // ---- DASHBOARD -----------------------------------------------------------
  await expect(page.getByText("Total outstanding")).toBeVisible();
  await expect(page.getByText("Pending imports")).toBeVisible();

  const token = await apiLogin(request);
  const before = await (
    await request.get(`${API_URL}/api/v1/dashboard/summary`, { headers: authHeader(token) })
  ).json();
  const customersBefore: number = before.data.customers;

  // ---- IMPORT → MAP → VALIDATE → CONFIRM -----------------------------------
  await uploadFixture(page, portfolio);
  const importId = /\/imports\/([0-9a-f-]{36})/.exec(page.url())?.[1];
  expect(importId).toBeTruthy();

  await mapColumns(page, {
    customer_name: "Customer Name",
    phone: "Phone",
    account_number: "Account Number",
    outstanding_amount: "Outstanding",
    due_date: "Due Date",
    creditor_name: "Creditor",
  });

  await page.getByRole("button", { name: "Validate" }).click();
  await expect(page.getByText("1 row(s) ready to import")).toBeVisible();

  await page.getByRole("button", { name: "Confirm import" }).click();
  await page.getByRole("button", { name: "Yes, import" }).click();
  await expect(page.getByText(/Imported 1 row\(s\)/)).toBeVisible();

  // ---- CUSTOMER CREATED → OPEN CUSTOMER ------------------------------------
  await page.goto("/customers");
  await page.getByLabel("Search customers").fill(debtor);
  await page.getByLabel("Search customers").press("Enter");
  const customerRow = page.getByRole("row").filter({ hasText: debtor });
  await expect(customerRow).toBeVisible();
  await customerRow.getByRole("link", { name: debtor }).click();

  await expect(page.getByRole("heading", { name: debtor })).toBeVisible();
  await expect(page.getByText("+919811122334")).toBeVisible();

  // ---- OPEN ACCOUNT --------------------------------------------------------
  await page.getByRole("link", { name: account }).click();
  await expect(page.getByRole("heading", { name: account })).toBeVisible();
  await expect(page.getByText("₹32,500.25").first()).toBeVisible();
  await expect(page.getByText(debtor)).toBeVisible();
  await expect(page.getByText("HDFC Bank")).toBeVisible();

  // ---- CREATE CAMPAIGN -----------------------------------------------------
  await page.goto("/campaigns");
  await page.getByRole("button", { name: "New campaign" }).click();
  await page.locator("#campaign-name").fill(campaign);
  await page.locator("#campaign-description").fill("Created by the Phase 1 acceptance test.");
  await page.getByRole("button", { name: "Create campaign" }).click();
  await page.getByRole("link", { name: campaign }).click();
  await expect(page.getByText("Campaign settings")).toBeVisible();

  // ---- ADD ACCOUNT TO CAMPAIGN --------------------------------------------
  await page.getByRole("button", { name: "Add accounts" }).first().click();
  await page.getByLabel("Search accounts").fill(account);
  await page.getByLabel(`Select ${account}`).click();
  await page.getByRole("button", { name: /Add 1 lead/ }).click();

  const leadRow = page.getByRole("row").filter({ hasText: account });
  await expect(leadRow).toBeVisible();

  // ---- REFRESH: everything is still there ---------------------------------
  await page.reload();
  await expect(page.getByRole("row").filter({ hasText: account })).toBeVisible();

  await page.goto(`/customers?search=${encodeURIComponent(debtor)}`);
  await page.getByLabel("Search customers").fill(debtor);
  await page.getByLabel("Search customers").press("Enter");
  await expect(page.getByRole("row").filter({ hasText: debtor })).toBeVisible();

  await page.goto("/accounts");
  await page.getByLabel("Search accounts").fill(account);
  await page.getByLabel("Search accounts").press("Enter");
  await expect(page.getByRole("row").filter({ hasText: account })).toBeVisible();

  // ---- DASHBOARD COUNTS UPDATED -------------------------------------------
  await page.goto("/");
  const after = await (
    await request.get(`${API_URL}/api/v1/dashboard/summary`, { headers: authHeader(token) })
  ).json();
  expect(after.data.customers).toBeGreaterThan(customersBefore);
  expect(after.data.active_campaigns).toBeGreaterThan(0);

  // The dashboard renders the backend's numbers, not invented ones.
  await expect(page.getByText(String(after.data.customers), { exact: true }).first()).toBeVisible();
  await expect(page.getByText(String(after.data.accounts), { exact: true }).first()).toBeVisible();

  // ---- LOGOUT → LOGIN AGAIN → DATA STILL EXISTS ---------------------------
  await logout(page);
  await login(page);

  await page.goto("/customers");
  await page.getByLabel("Search customers").fill(debtor);
  await page.getByLabel("Search customers").press("Enter");
  await expect(page.getByRole("row").filter({ hasText: debtor })).toBeVisible();
});

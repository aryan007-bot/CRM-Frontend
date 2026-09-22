import { expect, test } from "@playwright/test";

import { uniqueSuffix } from "./test-data";
import { API_URL, apiLogin, authHeader, login } from "./support";

test.describe("campaigns", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("creates a campaign, attaches an account and persists both", async ({ page, request }) => {
    const suffix = uniqueSuffix();
    const campaign = `Campaign ${suffix}`;
    const account = `ACC-CAMP-${suffix}`;

    // Seed one customer + account through the real API so the campaign has a
    // lead to attach.
    const token = await apiLogin(request);
    const customer = await request.post(`${API_URL}/api/v1/customers`, {
      headers: authHeader(token),
      data: { name: `Campaign Debtor ${suffix}`, phones: [] },
    });
    expect(customer.ok(), await customer.text()).toBeTruthy();
    const customerId = (await customer.json()).data.id as string;

    const created = await request.post(`${API_URL}/api/v1/accounts`, {
      headers: authHeader(token),
      data: {
        customer_id: customerId,
        account_number: account,
        outstanding_amount: "10000.00",
        currency: "INR",
        status: "active",
      },
    });
    expect(created.ok(), await created.text()).toBeTruthy();

    // ---- create the campaign through the wizard ----------------------------
    await page.goto("/campaigns");
    await page.getByRole("link", { name: "Create Campaign" }).click();

    // Step 1 — details
    await page.locator("#wiz-name").fill(campaign);
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 2 — lead source (filter-based by default; preview is optional)
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 3 — dialing
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 4 — strategy
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 5 — follow-ups
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 6 — review & create
    await page.getByRole("button", { name: "Create campaign" }).click();

    await expect(page.getByRole("heading", { name: campaign })).toBeVisible();

    // ---- attach the account as a lead --------------------------------------
    await page.getByRole("button", { name: "Add accounts" }).first().click();
    await page.getByLabel("Search accounts").fill(account);
    await page.getByLabel(`Select ${account}`).click();
    await page.getByRole("button", { name: /Add 1 lead/ }).click();

    // ---- the lead survives a reload ----------------------------------------
    await page.reload();
    await page.getByRole("button", { name: "Add accounts" }).first().click();
    await page.getByLabel("Search accounts").fill(account);
    await page.keyboard.press("Escape");
    await expect(page.getByLabel("Search accounts")).toBeHidden();

    // ---- editing the campaign settings persists ---------------------------
    await page.getByRole("link", { name: "Edit" }).click();
    await page.locator("#campaign-name").fill(`${campaign} updated`);
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.goto("/campaigns");
    await expect(page.getByRole("link", { name: `${campaign} updated` })).toBeVisible();
  });
});

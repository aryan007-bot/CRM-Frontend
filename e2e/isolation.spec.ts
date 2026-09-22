import { expect, test } from "@playwright/test";

import { ORGS, USERS, uniqueSuffix } from "./test-data";
import { API_URL, apiLogin, authHeader, login } from "./support";

/**
 * Multi-tenancy is enforced by the server, never by hiding UI. These checks
 * create data in organization A and then try to reach it as organization B,
 * both over the API and through the browser.
 */
test.describe("organization isolation", () => {
  test("organization B cannot see or reach organization A's records", async ({ page, request }) => {
    const suffix = uniqueSuffix();
    const debtor = `Tenant A Debtor ${suffix}`;

    const tokenA = await apiLogin(request, USERS.adminA.email);
    const created = await request.post(`${API_URL}/api/v1/customers`, {
      headers: authHeader(tokenA),
      data: {
        name: debtor,
        phones: [{ phone: "9833344455", phone_type: "mobile", is_primary: true }],
      },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    const customerId = (await created.json()).data.id as string;

    const account = await request.post(`${API_URL}/api/v1/accounts`, {
      headers: authHeader(tokenA),
      data: {
        customer_id: customerId,
        account_number: `ACC-ISO-${suffix}`,
        outstanding_amount: "1234.56",
        currency: "INR",
        status: "active",
      },
    });
    expect(account.ok(), await account.text()).toBeTruthy();
    const accountId = (await account.json()).data.id as string;

    // ---- the same lookups as organization B --------------------------------
    const tokenB = await apiLogin(request, USERS.adminB.email);

    const crossCustomer = await request.get(`${API_URL}/api/v1/customers/${customerId}`, {
      headers: authHeader(tokenB),
    });
    expect(crossCustomer.status()).toBe(404);

    const crossAccount = await request.get(`${API_URL}/api/v1/accounts/${accountId}`, {
      headers: authHeader(tokenB),
    });
    expect(crossAccount.status()).toBe(404);

    const crossSearch = await request.get(`${API_URL}/api/v1/customers?search=${debtor}`, {
      headers: authHeader(tokenB),
    });
    expect(crossSearch.ok()).toBeTruthy();
    expect((await crossSearch.json()).total).toBe(0);

    const crossUpdate = await request.patch(`${API_URL}/api/v1/customers/${customerId}`, {
      headers: authHeader(tokenB),
      data: { name: "Taken over" },
    });
    expect(crossUpdate.status()).toBe(404);

    // ---- the same checks in the browser ------------------------------------
    await login(page, USERS.adminB.email);
    await page.goto("/profile");
    await expect(page.getByText(ORGS.b.name).first()).toBeVisible();

    // B's own portfolio is not accidentally populated with A's rows.
    await page.goto("/accounts");
    await expect(page.getByText("ACC-ISO-", { exact: false })).toHaveCount(0);

    await page.goto("/customers");
    await page.getByLabel("Search customers").fill(debtor);
    await page.getByLabel("Search customers").press("Enter");
    await expect(page.getByText("No customers match")).toBeVisible();

    // A deep link into A's record fails closed rather than rendering it.
    await page.goto(`/customers/${customerId}`);
    await expect(page.getByText("Could not load this data")).toBeVisible();
    await expect(page.getByText(debtor)).toHaveCount(0);

    await page.goto(`/accounts/${accountId}`);
    await expect(page.getByText("Could not load this data")).toBeVisible();
  });
});

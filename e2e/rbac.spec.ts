import { expect, test } from "@playwright/test";

import { USERS, uniqueSuffix } from "./test-data";
import { API_URL, apiLogin, authHeader, login } from "./support";

/** Writes the RBAC matrix against the real endpoints, not a UI approximation. */
test.describe("role-based access control", () => {
  test("a viewer can read but never write", async ({ request }) => {
    const token = await apiLogin(request, USERS.viewerA.email);

    expect(
      (await request.get(`${API_URL}/api/v1/customers`, { headers: authHeader(token) })).status(),
    ).toBe(200);
    expect(
      (await request.get(`${API_URL}/api/v1/accounts`, { headers: authHeader(token) })).status(),
    ).toBe(200);
    expect(
      (await request.get(`${API_URL}/api/v1/dashboard/summary`, { headers: authHeader(token) }))
        .status(),
    ).toBe(200);

    const forbidden = [
      ["post", `${API_URL}/api/v1/customers`, { name: `Viewer Attempt ${uniqueSuffix()}` }],
      ["post", `${API_URL}/api/v1/creditors`, { name: `Viewer Creditor ${uniqueSuffix()}` }],
      ["post", `${API_URL}/api/v1/campaigns`, { name: "Viewer Campaign" }],
    ] as const;

    for (const [method, url, data] of forbidden) {
      const response = await request[method](url, { headers: authHeader(token), data });
      expect(response.status(), `${method} ${url}`).toBe(403);
      expect((await response.json()).error.code).toBeTruthy();
    }
  });

  test("a supervisor can create records but cannot delete them", async ({ request }) => {
    const token = await apiLogin(request, USERS.supervisorA.email);
    const name = `Supervisor Debtor ${uniqueSuffix()}`;

    const created = await request.post(`${API_URL}/api/v1/customers`, {
      headers: authHeader(token),
      data: { name },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    const customerId = (await created.json()).data.id as string;

    const denied = await request.delete(`${API_URL}/api/v1/customers/${customerId}`, {
      headers: authHeader(token),
    });
    expect(denied.status()).toBe(403);

    // ...but it is still there, untouched.
    const stillThere = await request.get(`${API_URL}/api/v1/customers/${customerId}`, {
      headers: authHeader(token),
    });
    expect(stillThere.ok()).toBeTruthy();
  });

  test("an organization admin can delete within their own organization", async ({ request }) => {
    const token = await apiLogin(request, USERS.adminA.email);

    const created = await request.post(`${API_URL}/api/v1/customers`, {
      headers: authHeader(token),
      data: { name: `Deletable Debtor ${uniqueSuffix()}` },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    const customerId = (await created.json()).data.id as string;

    const deleted = await request.delete(`${API_URL}/api/v1/customers/${customerId}`, {
      headers: authHeader(token),
    });
    expect([200, 204]).toContain(deleted.status());

    const gone = await request.get(`${API_URL}/api/v1/customers/${customerId}`, {
      headers: authHeader(token),
    });
    expect(gone.status()).toBe(404);
  });

  test("a viewer sees the console without write affordances", async ({ page }) => {
    await login(page, USERS.viewerA.email);

    await page.goto("/customers");
    await expect(page.getByRole("button", { name: "New customer" })).toHaveCount(0);

    await page.goto("/imports");
    await expect(page.getByRole("button", { name: "Upload file" })).toHaveCount(0);

    await page.goto("/campaigns");
    await expect(page.getByRole("button", { name: "New campaign" })).toHaveCount(0);
  });
});

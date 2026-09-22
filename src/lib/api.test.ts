import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, tokenStore } from "./api";

/**
 * Minimal browser-like globals. The client deliberately only touches
 * localStorage when running in a browser, so the tests must look like one.
 */
function installBrowserGlobals() {
  const store = new Map<string, string>();
  const localStorageStub = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: globalThis,
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: localStorageStub,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api client", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    installBrowserGlobals();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // Remove the browser-like globals so state cannot leak between tests.
    delete (globalThis as Record<string, unknown>).window;
    delete (globalThis as Record<string, unknown>).localStorage;
  });

  it("builds query strings and omits empty filters", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ items: [], page: 2, page_size: 25, total: 0 }),
    );

    await api.listAccounts({
      page: 2,
      page_size: 25,
      search: "ACC-1",
      status: undefined,
      creditor_id: "",
    });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/v1/accounts?");
    expect(url).toContain("page=2");
    expect(url).toContain("page_size=25");
    expect(url).toContain("search=ACC-1");
    expect(url).not.toContain("status=");
    expect(url).not.toContain("creditor_id=");
  });

  it("unwraps the data envelope and sends the bearer token", async () => {
    tokenStore.set("test-token");
    fetchMock.mockResolvedValue(
      jsonResponse({ data: { id: "c1", name: "Rajesh Sharma" } }),
    );

    const customer = await api.getCustomer("c1");

    expect(customer.name).toBe("Rajesh Sharma");
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-token",
    );
  });

  it("sends exact decimal strings for money without converting to floats", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { id: "a1" } }));

    await api.createAccount({
      customer_id: "c1",
      account_number: "ACC-1",
      outstanding_amount: "25000.50",
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.outstanding_amount).toBe("25000.50");
    // The exact digits survive serialization.
    expect(init.body).toContain('"outstanding_amount":"25000.50"');
  });

  it("translates the error envelope into a typed ApiError", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: { code: "CUSTOMER_NOT_FOUND", message: "Customer not found" } },
        404,
      ),
    );

    const error = await api.getCustomer("missing").catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).code).toBe("CUSTOMER_NOT_FOUND");
    expect((error as ApiError).message).toBe("Customer not found");
  });

  it("clears the stored token on 401 so the UI cannot keep a dead session", async () => {
    tokenStore.set("expired-token");
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: "TOKEN_INVALID", message: "Invalid token" } }, 401),
    );

    await expect(api.me()).rejects.toBeInstanceOf(ApiError);
    expect(tokenStore.get()).toBeNull();
  });

  it("reports network failures with a user-safe message", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await api.getDashboardSummary().catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("NETWORK_ERROR");
    expect((error as ApiError).message).not.toContain("TypeError");
  });

  it("falls back to a generic message when the body is not JSON", async () => {
    fetchMock.mockResolvedValue(new Response("<html>502</html>", { status: 502 }));

    const error = await api.getDashboardSummary().catch((err: unknown) => err);

    expect((error as ApiError).status).toBe(502);
    expect((error as ApiError).message).toBe("Request failed with status 502.");
  });

  it("stores the token returned by login and clears it on logout", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        access_token: "fresh-token",
        token_type: "bearer",
        user: { id: "u1", email: "a@b.com" },
      }),
    );

    await api.login("a@b.com", "secret");
    expect(tokenStore.get()).toBe("fresh-token");

    fetchMock.mockResolvedValue(jsonResponse({ message: "Logged out successfully" }));
    await api.logout();
    expect(tokenStore.get()).toBeNull();
  });

  it("treats a failed logout as a local logout", async () => {
    tokenStore.set("token");
    fetchMock.mockRejectedValue(new TypeError("offline"));

    await expect(api.logout()).resolves.toBeUndefined();
    expect(tokenStore.get()).toBeNull();
  });

  it("uploads files as multipart form data without setting a JSON content type", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: {
          import_id: "i1",
          filename: "valid.csv",
          file_type: "csv",
          detected_columns: ["Name"],
          row_count: 1,
          suggested_mapping: { customer_name: "Name" },
        },
      }),
    );

    const file = new File(["a,b"], "valid.csv", { type: "text/csv" });
    await api.uploadImport(file);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/v1/imports/upload");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });
});

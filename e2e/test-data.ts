/**
 * Deterministic, synthetic data shared by the E2E global setup and the specs.
 *
 * This is test-only data. Nothing here is imported by application code.
 */

import path from "node:path";

export const API_PORT = 8000;
export const WEB_PORT = 3000;

export const E2E_DIR = __dirname;
export const FRONTEND_DIR = path.resolve(__dirname, "..");
export const BACKEND_DIR = path.resolve(FRONTEND_DIR, "..", "BACKEND");
export const FIXTURES_DIR = path.join(BACKEND_DIR, "tests", "fixtures");
export const DB_FILE = path.join(BACKEND_DIR, "e2e.sqlite");
export const STATE_DIR = path.join(E2E_DIR, ".state");

export const API_HEALTH_URL = `http://127.0.0.1:${API_PORT}/health`;
export const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;

export const PASSWORD = "ChangeMe123!";

export const ORGS = {
  a: { name: "Meridian Recovery", slug: "meridian" },
  b: { name: "Northwind Collections", slug: "northwind" },
};

// NOTE: `@example.com` rather than a reserved TLD such as `.test` — the API
// validates emails with Pydantic's EmailStr, which rejects special-use domains.
export const USERS = {
  adminA: { email: "admin.a@example.com", name: "Asha Admin", role: "ORG_ADMIN" },
  supervisorA: { email: "supervisor.a@example.com", name: "Sam Supervisor", role: "SUPERVISOR" },
  viewerA: { email: "viewer.a@example.com", name: "Vik Viewer", role: "VIEWER" },
  adminB: { email: "admin.b@example.com", name: "Bina Admin", role: "ORG_ADMIN" },
};

/** Unique-per-run suffix so repeated runs never collide on unique fields. */
export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`.slice(-7);
}

/**
 * A ten-digit Indian mobile number. The suffix above is alphanumeric but phone
 * values must be digits, so numbers are generated separately.
 */
export function randomPhone(): string {
  return `9${Math.floor(100000000 + Math.random() * 899999999)}`;
}

export const FIXTURES = {
  validXlsx: path.join(FIXTURES_DIR, "valid-recovery.xlsx"),
  validCsv: path.join(FIXTURES_DIR, "valid-recovery.csv"),
  invalidCsv: path.join(FIXTURES_DIR, "invalid-recovery.csv"),
  duplicateCsv: path.join(FIXTURES_DIR, "duplicate-recovery.csv"),
};

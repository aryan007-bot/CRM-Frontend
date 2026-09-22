/**
 * Playwright global setup.
 *
 * Brings up the real stack the browser talks to:
 *   1. a throwaway SQLite database migrated with Alembic (same migrations as
 *      PostgreSQL — only the connection URL differs),
 *   2. two organizations with users, created through the application CLI,
 *   3. the real FastAPI app on :8000,
 *   4. the production Next.js build on :3000 (`npm run build` output).
 *
 * Nothing is mocked: every assertion in the specs travels over HTTP to the real
 * backend and into a real database.
 *
 * If a server is already listening on either port it is reused and left alone,
 * so the suite can also be run against `npm run dev` + `uvicorn --reload`.
 */

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  API_HEALTH_URL,
  API_PORT,
  BACKEND_DIR,
  DB_FILE,
  FRONTEND_DIR,
  ORGS,
  PASSWORD,
  STATE_DIR,
  USERS,
  WEB_PORT,
  WEB_URL,
} from "./test-data";

const started: ChildProcess[] = [];

const API_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  ENVIRONMENT: "development",
  // Relative SQLite path, resolved against BACKEND_DIR (the process cwd).
  DATABASE_URL: "sqlite:///./e2e.sqlite",
  SECRET_KEY: "e2e-only-secret-key-with-more-than-32-characters",
  ALLOWED_ORIGINS: `http://localhost:${WEB_PORT},http://127.0.0.1:${WEB_PORT}`,
  CACHE_REQUIRED_FOR_READINESS: "false",
  // The whole suite shares one client IP, so keep the limit well above the
  // number of logins/uploads a run performs (the limiter itself is covered by
  // the backend test suite).
  LOGIN_RATE_LIMIT_PER_MINUTE: "500",
  UPLOAD_RATE_LIMIT_PER_MINUTE: "500",
  LOG_LEVEL: "WARNING",
};

function pythonExecutable(): string {
  const candidates =
    process.platform === "win32"
      ? [path.join(BACKEND_DIR, ".venv", "Scripts", "python.exe")]
      : [path.join(BACKEND_DIR, ".venv", "bin", "python")];

  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(
      `No Python virtualenv found (looked for ${candidates.join(", ")}).\n` +
        "Create it first:  cd BACKEND && python -m venv .venv && " +
        '.venv/Scripts/pip install -r requirements-dev.txt',
    );
  }
  return found;
}

function run(command: string, args: string[], label: string): void {
  const result = spawnSync(command, args, {
    cwd: BACKEND_DIR,
    env: API_ENV,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(
      `${label} failed (exit ${result.status}).\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }
}

function start(
  name: string,
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): ChildProcess {
  const log = createWriteStream(path.join(STATE_DIR, `${name}.log`), { flags: "a" });
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    shell: process.platform === "win32" && command === "npm",
  });

  child.stdout?.pipe(log);
  child.stderr?.pipe(log);
  started.push(child);
  return child;
}

async function isUp(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitFor(url: string, label: string, timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await isUp(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `${label} did not become ready within ${timeoutMs}ms. See logs in ${STATE_DIR}.`,
  );
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  mkdirSync(STATE_DIR, { recursive: true });

  const python = pythonExecutable();

  // ---- 1. fresh database, migrated with the real Alembic chain -------------
  rmSync(DB_FILE, { force: true });
  run(python, ["-m", "alembic", "upgrade", "head"], "alembic upgrade head");

  // ---- 2. two tenants, created through the application CLI -----------------
  for (const org of [ORGS.a, ORGS.b]) {
    run(python, ["-m", "app.cli", "create-org", "--name", org.name, "--slug", org.slug], "create-org");
  }

  const users = [
    { ...USERS.adminA, org: ORGS.a.slug },
    { ...USERS.supervisorA, org: ORGS.a.slug },
    { ...USERS.viewerA, org: ORGS.a.slug },
    { ...USERS.adminB, org: ORGS.b.slug },
  ];

  for (const user of users) {
    run(
      python,
      [
        "-m",
        "app.cli",
        "create-user",
        "--org-slug",
        user.org,
        "--email",
        user.email,
        "--password",
        PASSWORD,
        "--name",
        user.name,
        "--role",
        user.role,
      ],
      `create-user ${user.email}`,
    );
  }

  // ---- 3. the API ----------------------------------------------------------
  const apiAlreadyUp = await isUp(API_HEALTH_URL);
  if (!apiAlreadyUp) {
    start(
      "api",
      python,
      ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(API_PORT)],
      BACKEND_DIR,
      API_ENV,
    );
  }
  await waitFor(API_HEALTH_URL, "FastAPI");

  // ---- 4. the production frontend build ------------------------------------
  if (!existsSync(path.join(FRONTEND_DIR, ".next", "BUILD_ID"))) {
    throw new Error(
      "No production build found in FRONTEND/.next. Run `npm run test:e2e`, which builds first.",
    );
  }

  const webAlreadyUp = await isUp(WEB_URL);
  if (!webAlreadyUp) {
    start(
      "web",
      "npm",
      ["run", "start", "--", "--port", String(WEB_PORT)],
      FRONTEND_DIR,
      { ...process.env, PORT: String(WEB_PORT), NEXT_TELEMETRY_DISABLED: "1" },
    );
  }
  await waitFor(`${WEB_URL}/login`, "Next.js");

  const pids = started.map((child) => child.pid).filter((pid): pid is number => pid !== undefined);
  writeFileSync(path.join(STATE_DIR, "pids.json"), JSON.stringify(pids, null, 2), "utf8");
  writeFileSync(
    path.join(STATE_DIR, "stack.json"),
    JSON.stringify({ api: API_PORT, web: WEB_PORT, reusedApi: apiAlreadyUp, reusedWeb: webAlreadyUp }, null, 2),
    "utf8",
  );

  return async () => {
    for (const child of started) {
      if (child.pid === undefined || child.exitCode !== null) continue;
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        child.kill("SIGTERM");
      }
    }
  };
}

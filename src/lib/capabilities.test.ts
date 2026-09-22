import { describe, expect, it } from "vitest";
import { can } from "./capabilities";
import type { Role } from "./types";

const ROLES: Record<string, Role[]> = {
  superAdmin: ["SUPER_ADMIN"],
  orgAdmin: ["ORG_ADMIN"],
  supervisor: ["SUPERVISOR"],
  aiManager: ["AI_MANAGER"],
  agent: ["AGENT"],
  viewer: ["VIEWER"],
  mixed: ["AGENT", "SUPERVISOR"],
};

describe("capability checks", () => {
  it("grants SUPER_ADMIN everything", () => {
    expect(can("campaign.stop", ROLES.superAdmin)).toBe(true);
    expect(can("automation.manage", ROLES.superAdmin)).toBe(true);
    expect(can("export.download", ROLES.superAdmin)).toBe(true);
  });

  it("allows operators to run campaigns but not viewers", () => {
    expect(can("campaign.start", ROLES.orgAdmin)).toBe(true);
    expect(can("campaign.start", ROLES.supervisor)).toBe(true);
    expect(can("campaign.start", ROLES.aiManager)).toBe(true);
    expect(can("campaign.start", ROLES.viewer)).toBe(false);
    expect(can("campaign.start", ROLES.agent)).toBe(false);
  });

  it("allows everyone with a role to read recovery data", () => {
    for (const roles of Object.values(ROLES)) {
      expect(can("recovery.read", roles)).toBe(true);
      expect(can("analytics.read", roles)).toBe(true);
    }
  });

  it("restricts automation management to admins and AI managers", () => {
    expect(can("automation.manage", ROLES.orgAdmin)).toBe(true);
    expect(can("automation.manage", ROLES.aiManager)).toBe(true);
    expect(can("automation.manage", ROLES.supervisor)).toBe(false);
    expect(can("automation.manage", ROLES.viewer)).toBe(false);
  });

  it("restricts export creation to operators", () => {
    expect(can("export.create", ROLES.orgAdmin)).toBe(true);
    expect(can("export.create", ROLES.supervisor)).toBe(true);
    expect(can("export.create", ROLES.viewer)).toBe(false);
  });

  it("handles mixed role lists via any-match", () => {
    expect(can("campaign.update", ROLES.mixed)).toBe(true);
    expect(can("automation.manage", ROLES.mixed)).toBe(false);
  });

  it("denies everything for missing roles", () => {
    expect(can("recovery.read", undefined)).toBe(false);
    expect(can("recovery.read", [])).toBe(false);
  });
});

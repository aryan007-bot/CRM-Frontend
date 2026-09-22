"use client";

/**
 * Phase 3 capability checks — UX only.
 *
 * The backend authorises every request; these helpers merely hide or disable
 * UI the current role cannot use so operators never see actions that would
 * fail. Mirrors the spec's capability list onto the existing role model.
 */

import type { Role } from "./types";

export type Capability =
  | "campaign.read"
  | "campaign.create"
  | "campaign.update"
  | "campaign.start"
  | "campaign.pause"
  | "campaign.stop"
  | "recovery.read"
  | "recovery.manage"
  | "ptp.read"
  | "ptp.manage"
  | "callback.read"
  | "callback.manage"
  | "dispute.read"
  | "dispute.manage"
  | "escalation.read"
  | "escalation.manage"
  | "automation.read"
  | "automation.manage"
  | "analytics.read"
  | "export.create"
  | "export.download";

const READ_ALL: Role[] = ["ORG_ADMIN", "SUPERVISOR", "AI_MANAGER", "AGENT", "VIEWER"];
const OPERATOR: Role[] = ["ORG_ADMIN", "SUPERVISOR", "AI_MANAGER"];
const MANAGER: Role[] = ["ORG_ADMIN", "AI_MANAGER"];

/** capability -> roles allowed to see/use it. SUPER_ADMIN bypasses everything. */
const CAPABILITY_ROLES: Record<Capability, Role[]> = {
  "campaign.read": READ_ALL,
  "campaign.create": OPERATOR,
  "campaign.update": OPERATOR,
  "campaign.start": OPERATOR,
  "campaign.pause": OPERATOR,
  "campaign.stop": OPERATOR,
  "recovery.read": READ_ALL,
  "recovery.manage": OPERATOR,
  "ptp.read": READ_ALL,
  "ptp.manage": OPERATOR,
  "callback.read": READ_ALL,
  "callback.manage": OPERATOR,
  "dispute.read": READ_ALL,
  "dispute.manage": OPERATOR,
  "escalation.read": READ_ALL,
  "escalation.manage": OPERATOR,
  "automation.read": READ_ALL,
  "automation.manage": MANAGER,
  "analytics.read": READ_ALL,
  "export.create": OPERATOR,
  "export.download": READ_ALL,
};

export function can(capability: Capability, roles: Role[] | undefined): boolean {
  if (!roles || roles.length === 0) return false;
  if (roles.includes("SUPER_ADMIN")) return true;
  return CAPABILITY_ROLES[capability].some((role) => roles.includes(role));
}

/** Convenience hook-style helper for components that already hold the user. */
export function useCapabilities(roles: Role[] | undefined) {
  return (capability: Capability) => can(capability, roles);
}

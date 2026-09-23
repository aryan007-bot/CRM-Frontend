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
  |  "analytics.read"
  | "export.create"
  | "export.download"
  // ---- Phase 4: control plane (spec §45) ----
  | "system.read"
  | "system.manage"
  | "infrastructure.read"
  | "infrastructure.manage"
  | "worker.read"
  | "worker.manage"
  | "queue.read"
  | "queue.manage"
  | "ai_provider.read"
  | "ai_provider.manage"
  | "ai_model.read"
  | "ai_model.manage"
  | "ai_routing.read"
  | "ai_routing.manage"
  | "usage.read"
  | "incident.read"
  | "incident.manage"
  | "alert.read"
  | "alert.manage"
  | "deployment.read"
  | "deployment.manage"
  | "configuration.read"
  | "configuration.manage"
  | "security.read"
  | "audit.read";

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

  // Phase 4: operational reads go to operator roles; management stays admin-only.
  // The backend authorises every request — these maps only hide UI.
  "system.read": OPERATOR,
  "system.manage": ["ORG_ADMIN"],
  "infrastructure.read": OPERATOR,
  "infrastructure.manage": ["ORG_ADMIN"],
  "worker.read": OPERATOR,
  "worker.manage": ["ORG_ADMIN"],
  "queue.read": OPERATOR,
  "queue.manage": ["ORG_ADMIN"],
  "ai_provider.read": OPERATOR,
  "ai_provider.manage": MANAGER,
  "ai_model.read": OPERATOR,
  "ai_model.manage": MANAGER,
  "ai_routing.read": OPERATOR,
  "ai_routing.manage": MANAGER,
  "usage.read": OPERATOR,
  "incident.read": OPERATOR,
  "incident.manage": OPERATOR,
  "alert.read": OPERATOR,
  "alert.manage": OPERATOR,
  "deployment.read": ["ORG_ADMIN"],
  "deployment.manage": ["ORG_ADMIN"],
  "configuration.read": ["ORG_ADMIN"],
  "configuration.manage": ["ORG_ADMIN"],
  "security.read": ["ORG_ADMIN"],
  "audit.read": ["ORG_ADMIN", "SUPERVISOR"],
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

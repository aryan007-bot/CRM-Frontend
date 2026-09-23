import { describe, expect, it } from "vitest";
import {
  systemStateMeta,
  healthMeta,
  workerStatusMeta,
  providerStatusMeta,
  needsAttention,
  routingRoleMeta,
  jobStatusMeta,
  deploymentStatusMeta,
} from "./phase4-meta";

describe("phase4 status metadata", () => {
  it("maps known system states to labels and tones", () => {
    expect(systemStateMeta("OPERATIONAL").label).toBe("Operational");
    expect(systemStateMeta("OPERATIONAL").tone).toBe("success");
    expect(systemStateMeta("degraded").label).toBe("Degraded");
    expect(systemStateMeta("degraded").tone).toBe("warning");
    expect(systemStateMeta("PARTIAL_OUTAGE").tone).toBe("danger");
    expect(systemStateMeta("CRITICAL").tone).toBe("danger");
  });

  it("normalizes case and falls back for unknown values", () => {
    const unknown = healthMeta("SOME_NEW_STATE");
    expect(unknown.tone).toBe("neutral");
    expect(unknown.label).toBe("some new state");

    expect(healthMeta(null).label).toBe("—");
    expect(healthMeta(undefined).tone).toBe("muted");
  });

  it("covers worker and queue lifecycle states", () => {
    expect(workerStatusMeta("DRAINING").label).toBe("Draining");
    expect(workerStatusMeta("STARTING").tone).toBe("progress");
    expect(jobStatusMeta("DEAD").tone).toBe("danger");
    expect(jobStatusMeta("RECOVERED").tone).toBe("success");
  });

  it("maps provider statuses including quota and rate limiting", () => {
    expect(providerStatusMeta("RATE_LIMITED").tone).toBe("warning");
    expect(providerStatusMeta("QUOTA_EXHAUSTED").tone).toBe("warning");
    expect(providerStatusMeta("ENABLED").tone).toBe("success");
    expect(providerStatusMeta("DISABLED").tone).toBe("muted");
  });

  it("maps routing roles and deployment statuses", () => {
    expect(routingRoleMeta("PRIMARY").tone).toBe("success");
    expect(routingRoleMeta("FALLBACK").tone).toBe("info");
    expect(routingRoleMeta("NONE").label).toBe("Unrouted");
    expect(deploymentStatusMeta("ROLLED_BACK").tone).toBe("warning");
    expect(deploymentStatusMeta("FAILED").tone).toBe("danger");
  });

  it("flags states that need operator attention", () => {
    expect(needsAttention("DEGRADED")).toBe(true);
    expect(needsAttention("FAILED")).toBe(true);
    expect(needsAttention("PARTIAL_OUTAGE")).toBe(true);
    expect(needsAttention("CRITICAL")).toBe(true);
    expect(needsAttention("OPERATIONAL")).toBe(false);
    expect(needsAttention("HEALTHY")).toBe(false);
    expect(needsAttention(null)).toBe(false);
    expect(needsAttention(undefined)).toBe(false);
  });
});

/**
 * Phase 4 status metadata — single source of truth for labels, tones and
 * hints across every control-plane screen (same pattern as `lib/recovery.ts`).
 *
 * The backend sends the state string; these maps only decide how it is
 * *rendered*. Values are normalised to upper case for lookup. Unknown values
 * render with a neutral fallback instead of guessing.
 */

import type { MetaTone } from "./recovery";

export interface InfraStatusMeta {
  label: string;
  tone: MetaTone;
  hint: string;
}

function meta(label: string, tone: MetaTone, hint: string): InfraStatusMeta {
  return { label, tone, hint };
}

function lookup(map: Record<string, InfraStatusMeta>, value: string | null | undefined): InfraStatusMeta {
  if (!value) return meta("—", "muted", "No value reported.");
  const key = value.toUpperCase();
  return map[key] ?? meta(value.toLowerCase().replace(/[_-]+/g, " "), "neutral", "Unrecognised state value.");
}


// ---------- System / component health ----------

export const SYSTEM_STATE_META: Record<string, InfraStatusMeta> = {
  OPERATIONAL: meta("Operational", "success", "All components reported healthy."),
  DEGRADED: meta("Degraded", "warning", "Operating with reduced capacity or latency."),
  PARTIAL_OUTAGE: meta("Partial outage", "danger", "One or more components are down."),
  CRITICAL: meta("Critical", "danger", "Core functionality is unavailable."),
  UNKNOWN: meta("Unknown", "muted", "The backend has not reported a state."),
};

export const HEALTH_META: Record<string, InfraStatusMeta> = {
  HEALTHY: meta("Healthy", "success", "Responding within expected bounds."),
  DEGRADED: meta("Degraded", "warning", "Operating with reduced capacity."),
  UNAVAILABLE: meta("Unavailable", "danger", "Not responding — investigate now."),
  OFFLINE: meta("Offline", "danger", "Reported offline."),
  STARTING: meta("Starting", "progress", "Initialising — not yet serving."),
  DRAINING: meta("Draining", "warning", "Finishing current work; not accepting new."),
  STOPPED: meta("Stopped", "muted", "Intentionally stopped."),
  FAILED: meta("Failed", "danger", "Crashed or failed its last check."),
  UNKNOWN: meta("Unknown", "muted", "No recent heartbeat."),
};

// ---------- Workers / queues ----------

export const WORKER_STATUS_META: Record<string, InfraStatusMeta> = {
  STARTING: meta("Starting", "progress", "Booting — will serve once ready."),
  HEALTHY: meta("Healthy", "success", "Processing jobs normally."),
  DEGRADED: meta("Degraded", "warning", "Reduced capacity — some work may queue."),
  DRAINING: meta("Draining", "warning", "Finishing current jobs; not accepting new work."),
  STOPPED: meta("Stopped", "muted", "Stopped by an operator."),
  FAILED: meta("Failed", "danger", "Crashed — inspect recent errors."),
  UNKNOWN: meta("Unknown", "muted", "No recent heartbeat."),
};

export const QUEUE_STATE_META: Record<string, InfraStatusMeta> = {
  ACTIVE: meta("Active", "success", "Processing jobs."),
  PAUSED: meta("Paused", "warning", "Paused by an operator — jobs wait."),
  DEGRADED: meta("Degraded", "danger", "Backlog or failures above the backend threshold."),
  UNKNOWN: meta("Unknown", "muted", "No recent activity report."),
};

export const JOB_STATUS_META: Record<string, InfraStatusMeta> = {
  FAILED: meta("Failed", "danger", "Last attempt failed; may retry."),
  RETRYING: meta("Retrying", "warning", "A retry is scheduled or in progress."),
  DEAD: meta("Dead", "danger", "Exhausted retries — needs manual action."),
  CANCELLED: meta("Cancelled", "muted", "Cancelled before completion."),
  RECOVERED: meta("Recovered", "success", "Succeeded after earlier failures."),
};

// ---------- Telephony / gateways ----------

export const GATEWAY_STATE_META: Record<string, InfraStatusMeta> = {
  ONLINE: meta("Online", "success", "Registered and accepting calls."),
  DEGRADED: meta("Degraded", "warning", "Partial capacity — check registrations."),
  OFFLINE: meta("Offline", "danger", "Not registered — calls cannot route."),
  UNKNOWN: meta("Unknown", "muted", "No recent heartbeat."),
};

// ---------- AI providers ----------

export const PROVIDER_STATUS_META: Record<string, InfraStatusMeta> = {
  ENABLED: meta("Enabled", "success", "In the routing rotation."),
  DISABLED: meta("Disabled", "muted", "Removed from routing by an operator."),
  UNHEALTHY: meta("Unhealthy", "danger", "Failing checks — traffic routed away."),
  RATE_LIMITED: meta("Rate limited", "warning", "Provider is throttling requests."),
  QUOTA_EXHAUSTED: meta("Quota exhausted", "warning", "Configured quota used up until reset."),
  UNKNOWN: meta("Unknown", "muted", "Not checked recently."),
};

export const CREDENTIAL_STATE_META: Record<string, InfraStatusMeta> = {
  CONFIGURED: meta("Configured", "info", "Credentials present on the server."),
  CONNECTED: meta("Connected", "success", "Authenticated with the provider."),
  INVALID: meta("Invalid", "danger", "Credentials rejected — rotate on the backend."),
  EXPIRED: meta("Expired", "danger", "Credential validity ended."),
  NOT_CONFIGURED: meta("Not configured", "muted", "No credentials stored."),
};

export const ROUTING_ROLE_META: Record<string, InfraStatusMeta> = {
  PRIMARY: meta("Primary", "success", "First choice for requests."),
  FALLBACK: meta("Fallback", "info", "Used when earlier choices fail."),
  NONE: meta("Unrouted", "muted", "Not part of the routing chain."),
};

export const ROUTING_CONDITION_LABELS: Record<string, string> = {
  PROVIDER_UNAVAILABLE: "Provider unavailable",
  QUOTA_EXCEEDED: "Quota exceeded",
  RATE_LIMITED: "Rate limited",
  TIMEOUT: "Timeout",
  HIGH_LATENCY: "High latency",
  MODEL_UNAVAILABLE: "Model unavailable",
};

// ---------- Incidents / alerts / deployments ----------

export const INCIDENT_STATUS_META: Record<string, InfraStatusMeta> = {
  OPEN: meta("Open", "warning", "Acknowledged — investigation pending."),
  INVESTIGATING: meta("Investigating", "progress", "Actively being investigated."),
  MITIGATED: meta("Mitigated", "info", "Impact reduced; watching for recurrence."),
  RESOLVED: meta("Resolved", "success", "Service restored."),
  CLOSED: meta("Closed", "muted", "Closed after resolution."),
};

export const INCIDENT_SEVERITY_META: Record<string, InfraStatusMeta> = {
  SEV1: meta("SEV1", "danger", "Critical — major functionality down."),
  SEV2: meta("SEV2", "danger", "High — significant degradation."),
  SEV3: meta("SEV3", "warning", "Moderate — limited impact."),
  SEV4: meta("SEV4", "neutral", "Low — minimal impact."),
  UNKNOWN: meta("Unknown", "muted", "Severity not classified."),
};

export const ALERT_STATE_META: Record<string, InfraStatusMeta> = {
  ACTIVE: meta("Active", "warning", "Condition currently true."),
  ACKNOWLEDGED: meta("Acknowledged", "info", "Seen by an operator."),
  RESOLVED: meta("Resolved", "success", "Condition cleared."),
  DISABLED: meta("Disabled", "muted", "Evaluation disabled."),
};

export const DEPLOYMENT_STATUS_META: Record<string, InfraStatusMeta> = {
  PENDING: meta("Pending", "neutral", "Queued — has not started."),
  RUNNING: meta("Running", "progress", "Deploying now."),
  SUCCESS: meta("Success", "success", "Deployed and healthy."),
  FAILED: meta("Failed", "danger", "Deploy failed — inspect events."),
  ROLLED_BACK: meta("Rolled back", "warning", "Reverted to the previous version."),
};

// ---------- Events / security ----------

export const EVENT_SEVERITY_META: Record<string, InfraStatusMeta> = {
  INFO: meta("Info", "info", "Routine operational event."),
  WARNING: meta("Warning", "warning", "Worth reviewing."),
  ERROR: meta("Error", "danger", "Operation failed."),
  CRITICAL: meta("Critical", "danger", "Requires immediate attention."),
};

export const SECURITY_SEVERITY_META: Record<string, InfraStatusMeta> = {
  INFO: meta("Info", "info", "Routine recorded activity."),
  LOW: meta("Low", "neutral", "Minor — part of normal operations."),
  MEDIUM: meta("Medium", "warning", "Unusual — review when convenient."),
  HIGH: meta("High", "danger", "Serious — investigate promptly."),
  CRITICAL: meta("Critical", "danger", "Critical — treat as an incident."),
};

export const CONFIG_STATE_META: Record<string, InfraStatusMeta> = {
  CONFIGURED: meta("Configured", "success", "Value set for this environment."),
  NOT_CONFIGURED: meta("Not configured", "muted", "No value set."),
  INVALID: meta("Invalid", "danger", "Current value failed validation."),
  INHERITED: meta("Inherited", "info", "Inherited from the platform default."),
  MANAGED_EXTERNALLY: meta("Managed externally", "info", "Managed outside this control plane."),
};

// ---------- Lookup helpers ----------

export const systemStateMeta = (v: string | null | undefined) => lookup(SYSTEM_STATE_META, v);
export const healthMeta = (v: string | null | undefined) => lookup(HEALTH_META, v);
export const workerStatusMeta = (v: string | null | undefined) => lookup(WORKER_STATUS_META, v);
export const queueStateMeta = (v: string | null | undefined) => lookup(QUEUE_STATE_META, v);
export const jobStatusMeta = (v: string | null | undefined) => lookup(JOB_STATUS_META, v);
export const gatewayStateMeta = (v: string | null | undefined) => lookup(GATEWAY_STATE_META, v);
export const providerStatusMeta = (v: string | null | undefined) => lookup(PROVIDER_STATUS_META, v);
export const credentialStateMeta = (v: string | null | undefined) => lookup(CREDENTIAL_STATE_META, v);
export const routingRoleMeta = (v: string | null | undefined) => lookup(ROUTING_ROLE_META, v);
export const incidentStatusMeta = (v: string | null | undefined) => lookup(INCIDENT_STATUS_META, v);
export const incidentSeverityMeta = (v: string | null | undefined) => lookup(INCIDENT_SEVERITY_META, v);
export const alertStateMeta = (v: string | null | undefined) => lookup(ALERT_STATE_META, v);
export const deploymentStatusMeta = (v: string | null | undefined) => lookup(DEPLOYMENT_STATUS_META, v);
export const eventSeverityMeta = (v: string | null | undefined) => lookup(EVENT_SEVERITY_META, v);
export const securitySeverityMeta = (v: string | null | undefined) => lookup(SECURITY_SEVERITY_META, v);
export const configStateMeta = (v: string | null | undefined) => lookup(CONFIG_STATE_META, v);

/** True when the state warrants operator attention (drives header badges). */
export function needsAttention(state: string | null | undefined): boolean {
  if (!state) return false;
  return ["DEGRADED", "UNAVAILABLE", "OFFLINE", "FAILED", "PARTIAL_OUTAGE", "CRITICAL"].includes(
    state.toUpperCase(),
  );
}

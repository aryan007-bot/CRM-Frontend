/**
 * Phase 4 realtime helpers.
 *
 * - Routing: maps incoming WebSocket event names to the UI refresher keys that
 *   care about them (extends the Phase 3 `use-realtime-refresh` idea with the
 *   Phase 4 event families from spec §42).
 * - Dedupe: a small bounded LRU so the same realtime event is never processed
 *   twice (spec §73). Nothing is persisted to storage.
 * - Stream: converts realtime events into `RealtimeEvent` stream rows for the
 *   live event feed, newest first, bounded to keep memory flat.
 */

import type { RealtimeEvent } from "./phase4-types";

/**
 * Event-name prefixes → refresher keys. A refresher key can map to several
 * queries; each screen wires its own keys, and the shared "phase4" keys are
 * refreshed by the control-plane header.
 */
export const PHASE4_EVENT_ROUTING: { match: (event: string) => boolean; targets: string[] }[] = [
  { match: (e) => e.startsWith("system."), targets: ["phase4:system", "phase4:environments", "phase4:operations"] },
  { match: (e) => e.startsWith("service."), targets: ["phase4:services", "phase4:system", "phase4:service"] },
  { match: (e) => e.startsWith("worker."), targets: ["phase4:workers", "phase4:worker", "phase4:system", "phase4:operations", "phase4:capacity"] },
  { match: (e) => e.startsWith("queue."), targets: ["phase4:queues", "phase4:queue", "phase4:operations", "phase4:capacity"] },
  { match: (e) => e.startsWith("job."), targets: ["phase4:jobs", "phase4:queue", "phase4:operations"] },
  { match: (e) => e.startsWith("provider."), targets: ["phase4:providers", "phase4:provider", "phase4:ai-infra", "phase4:routing", "phase4:usage"] },
  { match: (e) => e.startsWith("model."), targets: ["phase4:models", "phase4:model", "phase4:ai-infra"] },
  { match: (e) => e.startsWith("routing."), targets: ["phase4:routing", "phase4:ai-infra"] },
  { match: (e) => e.startsWith("quota."), targets: ["phase4:usage", "phase4:provider"] },
  { match: (e) => e.startsWith("ai."), targets: ["phase4:ai-infra", "phase4:operations", "phase4:performance"] },
  { match: (e) => e.startsWith("telephony."), targets: ["phase4:telephony", "phase4:operations"] },
  { match: (e) => e.startsWith("gateway."), targets: ["phase4:telephony", "phase4:operations"] },
  { match: (e) => e.startsWith("call."), targets: ["phase4:operations"] },
  { match: (e) => e.startsWith("incident."), targets: ["phase4:incidents", "phase4:incident", "phase4:system", "phase4:alert-center"] },
  { match: (e) => e.startsWith("alert."), targets: ["phase4:alerts", "phase4:alert-center", "phase4:alert"] },
  { match: (e) => e.startsWith("deployment."), targets: ["phase4:deployments", "phase4:deployment", "phase4:environments"] },
  { match: (e) => e.startsWith("configuration."), targets: ["phase4:configuration"] },
  { match: (e) => e.startsWith("security."), targets: ["phase4:security"] },
  { match: (e) => e.startsWith("database."), targets: ["phase4:database", "phase4:system"] },
];

/** Returns the refresher keys an event name should refresh. */
export function targetsForEvent(eventName: string): string[] {
  return PHASE4_EVENT_ROUTING.filter((route) => route.match(eventName)).flatMap(
    (route) => route.targets,
  );
}

/** Category for the live event stream, derived from the event prefix. */
export function categoryForEvent(eventName: string): string {
  const prefix = eventName.split(".")[0]?.toLowerCase() ?? "";
  const table: Record<string, string> = {
    system: "system",
    service: "system",
    worker: "worker",
    queue: "queue",
    job: "queue",
    provider: "ai",
    model: "ai",
    routing: "ai",
    quota: "ai",
    ai: "ai",
    telephony: "telephony",
    gateway: "telephony",
    call: "telephony",
    incident: "system",
    alert: "system",
    deployment: "deployment",
    configuration: "system",
    security: "security",
    database: "system",
    campaign: "campaign",
    recovery: "recovery",
  };
  return table[prefix] ?? "system";
}

// ---------- Dedupe (spec §73) ----------

/**
 * Bounded insertion-order set. `seen(id)` returns true the first time an id is
 * observed and false afterwards; old ids fall out once the bound is exceeded
 * so memory stays flat. Nothing is persisted.
 */
export class EventDeduper {
  private readonly seenIds = new Set<string>();
  private order: string[] = [];

  constructor(private readonly max = 500) {}

  seen(id: string): boolean {
    if (this.seenIds.has(id)) return true;
    this.seenIds.add(id);
    this.order.push(id);
    if (this.order.length > this.max) {
      const evict = Math.ceil(this.max / 10);
      for (let i = 0; i < evict; i++) {
        const oldest = this.order.shift();
        if (oldest !== undefined) this.seenIds.delete(oldest);
      }
    }
    return false;
  }
}

// ---------- Live stream rows ----------

const MAX_STREAM_ROWS = 200;

/**
 * Prepends a realtime event to a bounded stream array. Pure: returns a new
 * array; the caller stores it in state. When the backend omits an event id the
 * timestamp+type pair stands in (two identical emissions are still deduped by
 * the EventDeduper only when ids exist).
 */
export function appendStreamEvent(
  stream: RealtimeEvent[],
  event: { id?: string; event: string; timestamp: string; data?: unknown },
): RealtimeEvent[] {
  const row: RealtimeEvent = {
    id: event.id ?? `${event.event}:${event.timestamp}`,
    at: event.timestamp,
    category: categoryForEvent(event.event),
    severity: severityForEvent(event.event, event.data),
    event_type: event.event,
    message: messageForEvent(event.event, event.data),
    entity: entityForEvent(event.data),
  };
  const next = [row, ...stream];
  return next.length > MAX_STREAM_ROWS ? next.slice(0, MAX_STREAM_ROWS) : next;
}

/** Severity heuristic for events that carry none — conservative, never inflates. */
export function severityForEvent(eventName: string, data?: unknown): string {
  const dataSeverity =
    typeof data === "object" && data !== null && "severity" in data
      ? String((data as { severity?: unknown }).severity ?? "").toUpperCase()
      : "";
  if (dataSeverity) return dataSeverity;

  const failedSuffixes = ["failed", "error", "unavailable", "offline", "stopped", "degraded", "rate_limited", "resolved_negative"];
  if (/(failed|error|unavailable|offline|crash)/.test(eventName)) return "ERROR";
  if (/(degraded|rate_limited|quota|backlog|draining|warning)/.test(eventName)) return "WARNING";
  if (/(resolved|recovered|restored|healthy|completed|started)/.test(eventName)) return "INFO";
  void failedSuffixes;
  return "INFO";
}

/** Human message for the stream row; falls back to the event name itself. */
export function messageForEvent(eventName: string, data?: unknown): string | null {
  if (typeof data === "object" && data !== null) {
    const d = data as { message?: unknown; title?: unknown };
    if (typeof d.message === "string" && d.message) return d.message;
    if (typeof d.title === "string" && d.title) return d.title;
  }
  return eventName;
}

function entityForEvent(data: unknown): RealtimeEvent["entity"] {
  if (typeof data !== "object" || data === null) return null;
  const d = data as { entity?: unknown; id?: unknown };
  if (
    typeof d.entity === "object" &&
    d.entity !== null &&
    "kind" in (d.entity as Record<string, unknown>)
  ) {
    const e = d.entity as { kind: string; id?: string; label?: string; href?: string };
    return { kind: e.kind, id: e.id ?? "", label: e.label ?? null, href: e.href };
  }
  if (typeof d.id === "string") {
    return { kind: categoryForEvent("x"), id: d.id, label: null };
  }
  return null;
}

// ---------- Timeframe helper (performance page) ----------

export const TIMEFRAMES = ["5m", "1h", "6h", "24h", "7d"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

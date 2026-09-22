"use client";

/**
 * Realtime → query refresh bridge (spec §27).
 *
 * Reuses the Phase 2 WebSocket. Incoming events are mapped to the query
 * refreshers that care about them, so screens update without full reloads and
 * without aggressive polling. A slow interval-based reconciliation (the
 * `refreshMs` fallback) covers dropped events; pass `refreshMs: 0` to disable.
 */

import { useCallback, useEffect, useRef } from "react";
import { useLiveCallSocket } from "@/hooks/use-live-call-socket";
import type { WebSocketEvent } from "@/lib/types";

type Refresher = () => void;

/** Logical event families from spec §47, matched by event-name prefix. */
const EVENT_ROUTING: { match: (event: string) => boolean; targets: string[] }[] = [
  { match: (e) => e.startsWith("campaign."), targets: ["campaigns", "campaign", "metrics"] },
  { match: (e) => e.startsWith("lead."), targets: ["leads", "queue", "metrics"] },
  { match: (e) => e.startsWith("recovery."), targets: ["queue"] },
  { match: (e) => e.startsWith("ptp."), targets: ["ptp", "metrics"] },
  { match: (e) => e.startsWith("callback."), targets: ["callbacks", "metrics"] },
  { match: (e) => e.startsWith("dispute."), targets: ["disputes", "metrics"] },
  { match: (e) => e.startsWith("escalation."), targets: ["escalations", "metrics"] },
  { match: (e) => e.startsWith("follow_up."), targets: ["follow-ups", "metrics"] },
  { match: (e) => e.startsWith("export."), targets: ["exports"] },
  { match: (e) => e.startsWith("call."), targets: ["calls"] },
];

export function useRealtimeRefresh(
  refreshers: Record<string, Refresher>,
  options: { refreshMs?: number } = {},
) {
  const { refreshMs = 60_000 } = options;

  const refreshersRef = useRef(refreshers);
  useEffect(() => {
    refreshersRef.current = refreshers;
  });

  const onEvent = useCallback((event: WebSocketEvent) => {
    const name = String(event.event ?? "");
    const targets = EVENT_ROUTING.filter((route) => route.match(name)).flatMap(
      (route) => route.targets,
    );
    if (targets.length === 0) return;
    for (const target of targets) {
      refreshersRef.current[target]?.();
    }
  }, []);

  const { connectionState } = useLiveCallSocket({ onEvent });

  // Low-frequency reconciliation only — never aggressive polling.
  useEffect(() => {
    if (!refreshMs || refreshMs <= 0) return;
    const interval = setInterval(() => {
      for (const refresh of Object.values(refreshersRef.current)) {
        refresh();
      }
    }, refreshMs);
    return () => clearInterval(interval);
  }, [refreshMs]);

  return { connectionState };
}

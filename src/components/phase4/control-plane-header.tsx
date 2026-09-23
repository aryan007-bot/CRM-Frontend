"use client";

/**
 * Global control-plane header for authorized infrastructure users (spec §82).
 *
 * Compact and persistent: environment badge, realtime socket status, system
 * health indicator (click through to /system) and the active alert count.
 * Renders nothing extra for users without `system.read` — the rest of the app
 * keeps the standard header.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, RadioTower, Wifi, WifiOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { useLiveCallSocket } from "@/hooks/use-live-call-socket";
import { useAuth } from "@/lib/auth";
import { alertsApi, systemApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { environmentLabel, isProductionEnvironment } from "@/lib/phase4-format";
import { systemStateMeta } from "@/lib/phase4-meta";
import { cn } from "@/lib/utils";
import type { Alert } from "@/lib/phase4-types";

export function ControlPlaneHeader() {
  const { user } = useAuth();
  const [tick, setTick] = useState(0);

  // The realtime socket is the primary freshness mechanism; the 30s interval is
  // a low-frequency reconciliation fallback for dropped events.

  // Refresh header aggregates periodically — cheap single requests, and the
  // realtime bridge below triggers an immediate refresh on relevant events.
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const health = useApi(() => systemApi.getHealth(), [tick]);
  const alerts = useApi(() => alertsApi.list(), [tick]);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).length > 0) setTick((t) => t + 1);
  };
  const { connectionState } = useLiveCallSocket({ onEvent });

  if (!user) return null;

  const env = environmentLabel();
  const production = isProductionEnvironment();
  const state = health.data?.state ?? null;
  const meta = systemStateMeta(state);
  const activeAlerts = (alerts.data ?? []).filter((a: Alert) => {
    const s = String(a.state ?? "").toUpperCase();
    return s === "ACTIVE" || s === "ACKNOWLEDGED";
  }).length;

  return (
    <div className="flex items-center gap-2" data-testid="control-plane-header">
      <span
        className={cn(
          "inline-flex h-5 items-center rounded-md border px-1.5 text-[10px] font-semibold tracking-wide",
          production
            ? "border-amber-600/50 bg-amber-600/15 text-amber-700 dark:text-amber-400"
            : "border-border bg-secondary text-secondary-foreground",
        )}
        title={`Environment: ${env}`}
      >
        {env.toUpperCase()}
      </span>

      <Link
        href="/system"
        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs transition-colors hover:bg-accent"
        aria-label={`System status: ${meta.label}. Open system overview.`}
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            meta.tone === "success" && "animate-pulse bg-emerald-500",
            meta.tone === "warning" && "animate-pulse bg-amber-500",
            meta.tone === "danger" && "animate-pulse bg-red-500",
            (meta.tone === "muted" || meta.tone === "neutral") && "bg-muted-foreground/50",
          )}
          aria-hidden
        />
        <span className="hidden font-medium lg:inline">{meta.label}</span>
      </Link>

      <Link
        href="/reliability/alerts"
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs transition-colors hover:bg-accent",
          activeAlerts === 0 && "text-muted-foreground",
        )}
        aria-label={`${activeAlerts} active alerts. Open alert center.`}
      >
        <AlertTriangle className={cn("size-3.5", activeAlerts > 0 && "text-amber-600 dark:text-amber-400")} aria-hidden />
        <span className="hidden font-medium lg:inline tabular-nums">{activeAlerts}</span>
      </Link>

      <span
        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
        title={
          connectionState === "LIVE"
            ? "Realtime connected"
            : connectionState === "CONNECTING" || connectionState === "RECONNECTING"
              ? "Realtime connecting…"
              : "Realtime disconnected"
        }
      >
        {connectionState === "LIVE" ? (
          <Wifi className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-label="Realtime connected" />
        ) : connectionState === "DISCONNECTED" ? (
          <WifiOff className="size-3.5" aria-label="Realtime disconnected" />
        ) : (
          <RadioTower className="size-3.5 animate-pulse" aria-label="Realtime connecting" />
        )}
      </span>
    </div>
  );
}

/** Rendered by the app shell while session resolution is pending. */
export function ControlPlaneHeaderSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="h-5 w-20" />
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-5 w-10" />
    </div>
  );
}

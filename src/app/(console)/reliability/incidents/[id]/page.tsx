"use client";

/**
 * Incident Detail (spec §26).
 *
 * Summary, affected services, timeline (actual event timestamps), metrics,
 * status management and resolution. Status changes require `incident.manage`
 * and go through the backend.
 */

import { useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { ErrorState } from "@/components/page-states";
import { EventStreamView, SectionCard, UpdatedAt } from "@/components/phase4/phase4-parts";
import { IncidentSeverityBadge, IncidentStatusBadge } from "@/components/phase4/phase4-badges";
import { DetailField } from "@/components/ops";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApi } from "@/hooks/use-api";
import { useLiveCallSocket } from "@/hooks/use-live-call-socket";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/capabilities";
import { incidentsApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { ApiError } from "@/lib/api";
import { formatDateTime, formatRelative } from "@/lib/format";
import { toast } from "sonner";
import type { IncidentStatus } from "@/lib/phase4-types";

const STATUSES: IncidentStatus[] = ["OPEN", "INVESTIGATING", "MITIGATED", "RESOLVED", "CLOSED"];

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();
  const canManage = can("incident.manage", user?.roles);

  const incident = useApi(id ? () => incidentsApi.get(id) : null, [id]);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).includes("phase4:incident")) incident.refresh();
  };
  useLiveCallSocket({ onEvent });

  const [busy, setBusy] = useState(false);

  const data = incident.data;

  async function updateStatus(status: IncidentStatus) {
    if (!id) return;
    setBusy(true);
    try {
      await incidentsApi.update(id, { status });
      toast.success(`Incident marked ${status.toLowerCase()}.`);
      incident.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title={data?.title ?? "Incident"}
        description={data ? `${data.id} · detected by ${data.detected_by ?? "unknown"}` : undefined}
        actions={
          <>
            <UpdatedAt at={data?.last_update_at} />
            {canManage && data ? (
              <Select
                value={String(data.status).toUpperCase()}
                onValueChange={(v) => void updateStatus(v as IncidentStatus)}
                disabled={busy}
              >
                <SelectTrigger className="w-44" aria-label="Incident status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </>
        }
      />

      {incident.error ? (
        <ErrorState message={incident.error} onRetry={incident.refresh} />
      ) : !data ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          <SectionCard title="Summary">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <DetailField label="Status" value={<IncidentStatusBadge value={data.status} />} />
              <DetailField label="Severity" value={<IncidentSeverityBadge value={data.severity} />} />
              <DetailField label="Affected services" value={data.services.join(", ") || "—"} />
              <DetailField label="Assigned" value={data.assigned_to ?? "unassigned"} />
              <DetailField label="Started" value={formatDateTime(data.started_at)} />
              <DetailField label="Resolved" value={data.resolved_at ? formatDateTime(data.resolved_at) : "—"} />
              <DetailField label="Detected by" value={data.detected_by ?? "—"} />
              <DetailField label="Last update" value={formatRelative(data.last_update_at)} />
            </div>
            {data.summary ? <p className="mt-3 text-sm">{data.summary}</p> : null}
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Timeline" description="Actual event timestamps from the backend.">
              <ol className="space-y-0">
                {data.timeline.map((t, i) => (
                  <li key={`${t.at}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
                    <span className="mt-1 size-2 shrink-0 rounded-full bg-border ring-4 ring-background" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm">{t.message}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDateTime(t.at)}
                        {t.actor ? ` · ${t.actor}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
                {data.timeline.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No timeline entries recorded.</p>
                ) : null}
              </ol>
            </SectionCard>

            <div className="space-y-4">
              {data.metrics ? (
                <SectionCard title="Metrics" description="Reported metric for the incident window.">
                  <MiniTrend points={data.metrics} />
                </SectionCard>
              ) : null}

              {data.actions_taken && data.actions_taken.length > 0 ? (
                <SectionCard title="Actions taken">
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {data.actions_taken.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </SectionCard>
              ) : null}

              {data.resolution ? (
                <SectionCard title="Resolution">
                  <p className="text-sm">{data.resolution}</p>
                </SectionCard>
              ) : null}
            </div>
          </div>

          <SectionCard title="Events" description="Raw platform events recorded during the incident.">
            <EventStreamView events={data.events} emptyLabel="No events recorded." maxRows={10} />
          </SectionCard>

          <SectionCard title="Audit">
            <ul className="space-y-1.5">
              {data.audit.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline gap-2 text-xs">
                  <span className="text-muted-foreground">{formatDateTime(a.at)}</span>
                  <span className="font-medium">{a.action}</span>
                  <span className="text-muted-foreground">
                    by {a.actor ?? "system"}
                    {a.detail ? ` · ${a.detail}` : ""}
                  </span>
                </li>
              ))}
              {data.audit.length === 0 ? <p className="text-xs text-muted-foreground">No audit entries.</p> : null}
            </ul>
          </SectionCard>
        </>
      )}
    </div>
  );
}

function MiniTrend({ points }: { points: { at: string; value: number | null }[] }) {
  const max = Math.max(...points.map((p) => p.value ?? 0), 1);
  return (
    <div>
      <div className="flex h-16 items-end gap-0.5" role="img" aria-label="Incident metric trend">
        {points.map((p) => (
          <div
            key={p.at}
            title={`${formatDateTime(p.at)}: ${p.value ?? 0}`}
            className="flex-1 rounded-t-sm bg-amber-500/70"
            style={{ height: `${Math.max(2, ((p.value ?? 0) / max) * 100)}%` }}
          />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Newest on the right · peak {max}</p>
    </div>
  );
}

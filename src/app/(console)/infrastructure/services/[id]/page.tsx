"use client";

/**
 * Service Detail (spec §6).
 *
 * Sections render only what the backend returned; the dependency graph uses
 * actual backend relationship data, never decorative placeholders.
 */

import { useParams } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { ErrorState } from "@/components/page-states";
import {
  DependencyGraph,
  EventStreamView,
  LatencyStat,
  SectionCard,
  UpdatedAt,
} from "@/components/phase4/phase4-parts";
import { HealthBadge, ScopeBadge } from "@/components/phase4/phase4-badges";
import { DetailField } from "@/components/ops";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { useLiveCallSocket } from "@/hooks/use-live-call-socket";
import { servicesApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { formatDateTime, formatRelative } from "@/lib/format";
import { formatMs } from "@/lib/phase4-format";

export default function ServiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const service = useApi(id ? () => servicesApi.get(id) : null, [id]);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).includes("phase4:service")) service.refresh();
  };
  useLiveCallSocket({ onEvent });

  const data = service.data;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title={data?.name ?? "Service"}
        description={data ? `${String(data.service_type)} · ${data.region ?? "no region"}` : undefined}
        actions={<UpdatedAt at={data?.updated_at} />}
      />

      {service.error ? (
        <ErrorState message={service.error} onRetry={service.refresh} />
      ) : !data ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <SectionCard title="Overview">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <DetailField label="Status" value={<HealthBadge value={data.state} />} />
              <DetailField label="Version" value={<span className="font-mono">{data.version ?? "—"}</span>} />
              <DetailField label="Region" value={data.region ?? "—"} />
              <DetailField label="Scope" value={<ScopeBadge scope={data.scope} />} />
              <DetailField label="Latency" value={<LatencyStat stats={{ avg_ms: data.latency_ms }} />} />
              <DetailField label="Uptime" value={data.uptime !== null ? `${(data.uptime * 100).toFixed(2)}%` : "—"} />
              <DetailField label="Active jobs" value={data.active_jobs ?? "—"} />
              <DetailField label="Last heartbeat" value={formatRelative(data.last_heartbeat_at)} />
            </div>
            {data.message ? (
              <p className="mt-3 text-xs text-muted-foreground">{data.message}</p>
            ) : null}
          </SectionCard>

          <SectionCard title="Dependencies" description="Reported relationships between services.">
            <DependencyGraph
              center={{ id: data.id, label: data.name, state: data.state }}
              dependencies={data.dependencies.map((d) => ({
                id: d.depends_on_id,
                label: d.depends_on_id,
                href: `/infrastructure/services/${d.depends_on_id}`,
              }))}
              dependents={data.dependents.map((d) => ({
                id: d.service_id,
                label: d.service_id,
                href: `/infrastructure/services/${d.service_id}`,
              }))}
            />
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Recent errors" description="Backend-recorded errors for this service.">
              {data.recent_errors.length === 0 ? (
                <p className="text-xs text-muted-foreground">No errors recorded.</p>
              ) : (
                <ul className="space-y-2">
                  {data.recent_errors.map((e) => (
                    <li key={e.id} className="rounded-md border px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{e.code ?? "ERROR"}</span>
                        <span className="text-[11px] text-muted-foreground">{formatDateTime(e.occurred_at)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{e.message ?? "No detail."}</p>
                      {e.count ? <p className="text-[10px] text-muted-foreground">×{e.count}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Recent events">
              <EventStreamView events={data.recent_events} emptyLabel="No events recorded." maxRows={8} />
            </SectionCard>
          </div>

          {data.configuration_summary.length > 0 ? (
            <SectionCard title="Configuration summary" description="Non-secret configuration state.">
              <ul className="space-y-1.5 text-xs">
                {data.configuration_summary.map((c) => (
                  <li key={c.key} className="flex items-center justify-between gap-3">
                    <span className="font-mono">{c.key}</span>
                    <span className="text-muted-foreground">{c.state.toLowerCase()}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}

          {data.deployment ? (
            <SectionCard title="Deployment">
              <DetailField
                label="Running version"
                value={
                  <span>
                    <span className="font-mono">{data.deployment.version ?? "—"}</span>{" "}
                    <span className="text-xs text-muted-foreground">({String(data.deployment.status).toLowerCase()})</span>
                  </span>
                }
              />
            </SectionCard>
          ) : null}
        </>
      )}
    </div>
  );
}

"use client";

/**
 * Service Health (spec §5) — all registered services with their heartbeat,
 * latency and error counts. Rows link into per-service detail pages.
 */

import Link from "next/link";
import { Server } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { UpdatedAt } from "@/components/phase4/phase4-parts";
import { HealthBadge, ScopeBadge } from "@/components/phase4/phase4-badges";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { useLiveCallSocket } from "@/hooks/use-live-call-socket";
import { servicesApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { formatRelative } from "@/lib/format";
import { formatMs, formatPercent } from "@/lib/phase4-format";

export default function ServicesPage() {
  const services = useApi(() => servicesApi.list(), []);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).includes("phase4:services")) services.refresh();
  };
  const { connectionState } = useLiveCallSocket({ onEvent });

  const data = services.data ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="Services"
        description="Registered platform services and their reported health."
        actions={<UpdatedAt at={data[0]?.updated_at} />}
      />

      <Card className="py-0">
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead className="text-right">Uptime</TableHead>
                  <TableHead>Last heartbeat</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                  <TableHead className="text-right">Active jobs</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead>Scope</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.loading && !services.data ? (
                  <TableSkeleton rows={8} columns={11} />
                ) : services.error ? (
                  <TableMessage
                    columns={11}
                    icon={Server}
                    title="Service health is unavailable"
                    description={services.error}
                    action={<HealthBadge value="UNKNOWN" />}
                  />
                ) : data.length === 0 ? (
                  <TableMessage
                    columns={11}
                    icon={Server}
                    title="No services registered."
                    description="The backend has not reported any services yet."
                  />
                ) : (
                  data.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link
                          href={`/infrastructure/services/${s.id}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {s.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">{String(s.service_type).toLowerCase()}</TableCell>
                      <TableCell><HealthBadge value={s.state} /></TableCell>
                      <TableCell className="font-mono text-xs">{s.version ?? "—"}</TableCell>
                      <TableCell className="text-xs">{s.region ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.uptime !== null ? formatPercent(s.uptime) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatRelative(s.last_heartbeat_at)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMs(s.latency_ms)}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.active_jobs ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.error_count ?? "—"}</TableCell>
                      <TableCell><ScopeBadge scope={s.scope} /></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {connectionState !== "LIVE" ? (
        <p className="text-xs text-muted-foreground">Realtime connection interrupted — showing last known data.</p>
      ) : null}
    </div>
  );
}

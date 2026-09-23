"use client";

/**
 * Incident Management (spec §25).
 *
 * Backend-defined incidents with severities and statuses. No sensationalized
 * wording — operational facts only.
 */

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { TableMessage, TableSkeleton } from "@/components/page-states";
import { IncidentSeverityBadge, IncidentStatusBadge } from "@/components/phase4/phase4-badges";
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
import { incidentsApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { formatDateTime, formatRelative } from "@/lib/format";

/** Human duration between start and (optional) resolution. */
function formatIncidentDuration(startedAt: string, resolvedAt: string | null): string {
  if (!resolvedAt) return "ongoing";
  const start = Date.parse(startedAt);
  const end = Date.parse(resolvedAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return "—";
  const mins = Math.max(0, Math.round((end - start) / 60_000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

export default function IncidentsPage() {
  const incidents = useApi(() => incidentsApi.list(), []);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).includes("phase4:incidents")) incidents.refresh();
  };
  useLiveCallSocket({ onEvent });

  const data = incidents.data ?? [];




  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="Incidents"
        description="Backend-detected incidents affecting platform services."
      />

      <Card className="py-0">
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Incident</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead>Detected by</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Last update</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.loading && !incidents.data ? (
                  <TableSkeleton rows={6} columns={9} />
                ) : incidents.error ? (
                  <TableMessage
                    columns={9}
                    icon={ShieldAlert}
                    title="Incident data is unavailable"
                    description={incidents.error}
                  />
                ) : data.length === 0 ? (
                  <TableMessage
                    columns={9}
                    icon={ShieldAlert}
                    title="No incidents recorded."
                    description="Open incidents appear here as the backend detects them."
                  />
                ) : (
                  data.map((inc) => (
                    <TableRow key={inc.id}>
                      <TableCell>
                        <Link href={`/reliability/incidents/${inc.id}`} className="font-medium underline-offset-4 hover:underline">
                          {inc.title}
                        </Link>
                      </TableCell>
                      <TableCell><IncidentSeverityBadge value={inc.severity} /></TableCell>
                      <TableCell><IncidentStatusBadge value={inc.status} /></TableCell>
                      <TableCell className="text-xs">{inc.services.join(", ") || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(inc.started_at)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatIncidentDuration(inc.started_at, inc.resolved_at)}</TableCell>


                      <TableCell className="text-xs">{inc.detected_by ?? "—"}</TableCell>
                      <TableCell className="text-xs">{inc.assigned_to ?? "unassigned"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatRelative(inc.last_update_at)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

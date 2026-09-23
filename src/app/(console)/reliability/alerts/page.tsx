"use client";

/**
 * Alert Center (spec §27 + §58).
 *
 * Global alert panel: active, acknowledged, resolved. Actions (acknowledge /
 * resolve / disable) go through the backend and require `alert.manage`. Alert
 * definitions come from the backend — the frontend never invents conditions.
 */

import Link from "next/link";
import { BellRing } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { AlertStateBadge } from "@/components/phase4/phase4-badges";
import { Button } from "@/components/ui/button";
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
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/capabilities";
import { alertsApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { ApiError } from "@/lib/api";
import { formatDateTime, formatRelative } from "@/lib/format";
import { toast } from "sonner";

export default function AlertsPage() {
  const { user } = useAuth();
  const canManage = can("alert.manage", user?.roles);

  const alerts = useApi(() => alertsApi.list(), []);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).includes("phase4:alert-center")) alerts.refresh();
  };
  useLiveCallSocket({ onEvent });

  const data = alerts.data ?? [];

  async function act(id: string, action: "acknowledge" | "resolve" | "disable") {
    try {
      await alertsApi.action(id, action);
      toast.success(`Alert ${action}d.`);
      alerts.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed.");
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="Alerts"
        description="Backend-evaluated alert conditions and their notification state."
      />

      <Card className="py-0">
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alert</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Last triggered</TableHead>
                  <TableHead>Notifications</TableHead>
                  <TableHead>Incident</TableHead>
                  <TableHead className="w-40">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.loading && !alerts.data ? (
                  <TableSkeleton rows={6} columns={9} />
                ) : alerts.error ? (
                  <TableMessage
                    columns={9}
                    icon={BellRing}
                    title="Alert data is unavailable"
                    description={alerts.error}
                  />
                ) : data.length === 0 ? (
                  <TableMessage
                    columns={9}
                    icon={BellRing}
                    title="No alerts configured."
                    description="Alerts appear once the backend reports them."
                  />
                ) : (
                  data.map((a) => {
                    const state = String(a.state).toUpperCase();
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell className="text-xs">{a.service ?? "—"}</TableCell>
                        <TableCell className="font-mono text-[11px]">{a.condition ?? "—"}</TableCell>
                        <TableCell><AlertStateBadge value={a.state} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {a.started_at ? formatRelative(a.started_at) : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatRelative(a.last_triggered_at)}
                        </TableCell>
                        <TableCell className="text-xs">{a.notification_status ?? "—"}</TableCell>
                        <TableCell>
                          {a.incident_id ? (
                            <Link
                              href={`/reliability/incidents/${a.incident_id}`}
                              className="text-xs underline-offset-4 hover:underline"
                            >
                              Open
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {canManage ? (
                            <div className="flex gap-1.5">
                              {state === "ACTIVE" ? (
                                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => void act(a.id, "acknowledge")}>
                                  Acknowledge
                                </Button>
                              ) : null}
                              {state === "ACTIVE" || state === "ACKNOWLEDGED" ? (
                                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => void act(a.id, "resolve")}>
                                  Resolve
                                </Button>
                              ) : null}
                              {state !== "DISABLED" ? (
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive" onClick={() => void act(a.id, "disable")}>
                                  Disable
                                </Button>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">view only</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Times shown: {formatDateTime(new Date().toISOString())} local. Alert definitions and thresholds are
        backend-managed; disabling an alert silences evaluation, it does not fix the underlying condition.
      </p>
    </div>
  );
}

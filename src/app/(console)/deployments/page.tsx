"use client";

/**
 * Deployments (spec §29).
 *
 * Environment, version, commit, status and migration state per deployment.
 * Deploy/rollback actions live on the detail page and only when the backend
 * explicitly supports them.
 */

import Link from "next/link";
import { GitBranch } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { DeploymentStatusBadge, HealthBadge } from "@/components/phase4/phase4-badges";
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
import { deploymentsApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { formatRelative } from "@/lib/format";

export default function DeploymentsPage() {
  const deployments = useApi(() => deploymentsApi.list(), []);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).includes("phase4:deployments")) deployments.refresh();
  };
  useLiveCallSocket({ onEvent });

  const data = deployments.data ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="Deployments"
        description="Deployment state per environment. Secrets are never displayed."
      />

      <Card className="py-0">
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Environment</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Commit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Migrations</TableHead>
                  <TableHead>Deployed</TableHead>
                  <TableHead>Deployed by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deployments.loading && !deployments.data ? (
                  <TableSkeleton rows={5} columns={8} />
                ) : deployments.error ? (
                  <TableMessage
                    columns={8}
                    icon={GitBranch}
                    title="Deployment status is unavailable"
                    description={deployments.error}
                  />
                ) : data.length === 0 ? (
                  <TableMessage
                    columns={8}
                    icon={GitBranch}
                    title="No deployments recorded."
                    description="Deployment history appears once the backend reports it."
                  />
                ) : (
                  data.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <Link href={`/deployments/${d.id}`} className="font-medium underline-offset-4 hover:underline">
                          {d.environment}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{d.version ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{d.commit ?? "—"}</TableCell>
                      <TableCell><DeploymentStatusBadge value={d.status} /></TableCell>
                      <TableCell><HealthBadge value={d.health} /></TableCell>
                      <TableCell className="text-xs">{d.migration_status ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatRelative(d.deployed_at)}</TableCell>
                      <TableCell className="text-xs">{d.deployed_by ?? "—"}</TableCell>
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

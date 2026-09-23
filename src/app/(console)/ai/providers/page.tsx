"use client";

/**
 * Provider Management (spec §16).
 *
 * Provider registry with status, health, quota and credential *state* — never
 * secret values. Enable/disable goes through the backend; the client never
 * contacts providers directly.
 */

import Link from "next/link";
import { Bot } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { UpdatedAt } from "@/components/phase4/phase4-parts";
import { CredentialStateBadge, ProviderStatusBadge, ScopeBadge } from "@/components/phase4/phase4-badges";
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
import { providersApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { formatCount, formatRelative } from "@/lib/format";
import { formatPercent } from "@/lib/phase4-format";

export default function ProvidersPage() {
  const providers = useApi(() => providersApi.list(), []);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).includes("phase4:providers")) providers.refresh();
  };
  useLiveCallSocket({ onEvent });

  const data = providers.data ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="AI Providers"
        description="Provider registry: status, health, quota and credential state. Secrets are masked server-side and never reach the browser."
        actions={<UpdatedAt at={data[0]?.last_checked_at} />}
      />

      <Card className="py-0">
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead className="text-right">Priority</TableHead>
                  <TableHead className="text-right">Models</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead className="text-right">Quota</TableHead>
                  <TableHead>Credentials</TableHead>
                  <TableHead>Last checked</TableHead>
                  <TableHead>Scope</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.loading && !providers.data ? (
                  <TableSkeleton rows={7} columns={12} />
                ) : providers.error ? (
                  <TableMessage
                    columns={12}
                    icon={Bot}
                    title="Provider health check failed"
                    description={providers.error}
                  />
                ) : data.length === 0 ? (
                  <TableMessage
                    columns={12}
                    icon={Bot}
                    title="No providers registered."
                    description="Providers appear once the backend registry reports them."
                  />
                ) : (
                  data.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link href={`/ai/providers/${p.id}`} className="font-medium underline-offset-4 hover:underline">
                          {p.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">{p.provider_type}</TableCell>
                      <TableCell><ProviderStatusBadge value={p.status} /></TableCell>
                      <TableCell>
                        <span
                          className={
                            p.health === "HEALTHY"
                              ? "text-xs font-medium text-emerald-700 dark:text-emerald-400"
                              : p.health === "DEGRADED"
                                ? "text-xs font-medium text-amber-700 dark:text-amber-400"
                                : "text-xs font-medium text-muted-foreground"
                          }
                        >
                          {p.health.toLowerCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.priority ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.model_count ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCount(p.requests)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCount(p.errors)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.quota ? formatPercent(p.quota.utilization) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-0.5">
                          <CredentialStateBadge value={p.credential_state} />
                          {p.credential_mask ? (
                            <span className="font-mono text-[10px] text-muted-foreground">{p.credential_mask}</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatRelative(p.last_checked_at)}</TableCell>
                      <TableCell><ScopeBadge scope={p.scope} /></TableCell>
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

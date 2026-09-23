"use client";

/**
 * Model Management (spec §18).
 *
 * Model registry with provider, availability, latency and fallback role.
 * Capability flags (context limit, streaming, tools) render only when the
 * backend supplies them — nothing is invented.
 */

import Link from "next/link";
import { BrainCircuit } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { UpdatedAt } from "@/components/phase4/phase4-parts";
import { HealthBadge, RoutingRoleBadge } from "@/components/phase4/phase4-badges";
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
import { modelsApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { formatCount, formatRelative } from "@/lib/format";
import { formatPercent } from "@/lib/phase4-format";

export default function ModelsPage() {
  const models = useApi(() => modelsApi.list(), []);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).includes("phase4:models")) models.refresh();
  };
  useLiveCallSocket({ onEvent });

  const data = models.data ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="AI Models"
        description="Model registry across providers. Capability flags appear only when the backend reports them."
        actions={<UpdatedAt at={null} />}
      />

      <Card className="py-0">
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Availability</TableHead>
                  <TableHead className="text-right">Avg latency</TableHead>
                  <TableHead className="text-right">Error rate</TableHead>
                  <TableHead className="text-right">Usage</TableHead>
                  <TableHead>Fallback role</TableHead>
                  <TableHead className="text-right">Context</TableHead>
                  <TableHead>Capabilities</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.loading && !models.data ? (
                  <TableSkeleton rows={7} columns={11} />
                ) : models.error ? (
                  <TableMessage
                    columns={11}
                    icon={BrainCircuit}
                    title="Model data is unavailable"
                    description={models.error}
                  />
                ) : data.length === 0 ? (
                  <TableMessage
                    columns={11}
                    icon={BrainCircuit}
                    title="No models registered."
                    description="Models appear once the backend registry reports them."
                  />
                ) : (
                  data.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <Link href={`/ai/models/${m.id}`} className="font-mono text-xs font-medium underline-offset-4 hover:underline">
                          {m.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">{m.provider_name ?? "—"}</TableCell>
                      <TableCell className="text-xs">{m.model_type}</TableCell>
                      <TableCell className="text-xs">{m.enabled ? "yes" : "no"}</TableCell>
                      <TableCell><HealthBadge value={m.availability} /></TableCell>
                      <TableCell className="text-right tabular-nums">
                        {m.latency?.avg_ms != null ? `${formatCount(m.latency.avg_ms)} ms` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {m.error_rate !== null ? formatPercent(m.error_rate) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCount(m.usage_count)}</TableCell>
                      <TableCell><RoutingRoleBadge value={m.fallback_role} /></TableCell>
                      <TableCell className="text-right tabular-nums">
                        {m.context_limit !== null ? formatCount(m.context_limit) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {[
                          m.streaming === true ? "streaming" : null,
                          m.function_calling === true ? "tools" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </TableCell>
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

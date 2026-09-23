"use client";

/**
 * Provider Detail (spec §17).
 *
 * Overview, models, health, errors, routing role and credential *metadata*.
 * Actions: enable/disable, test connection, refresh health — all backend
 * operations; the frontend never contacts provider APIs with secret keys.
 */

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/app-shell";
import { ErrorState } from "@/components/page-states";
import { LatencyStat, SectionCard, UpdatedAt, UtilizationBar } from "@/components/phase4/phase4-parts";
import {
  CredentialStateBadge,
  ProviderStatusBadge,
  RoutingRoleBadge,
  ScopeBadge,
} from "@/components/phase4/phase4-badges";
import { DangerActionDialog, type DangerActionContext } from "@/components/phase4/danger-action-dialog";
import { DetailField } from "@/components/ops";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { providersApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { ApiError } from "@/lib/api";
import { environmentLabel } from "@/lib/phase4-format";
import { formatCount, formatDateTime, formatRelative } from "@/lib/format";
import { toast } from "sonner";

export default function ProviderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();
  const canManage = can("ai_provider.manage", user?.roles);

  const provider = useApi(id ? () => providersApi.get(id) : null, [id]);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).includes("phase4:provider")) provider.refresh();
  };
  useLiveCallSocket({ onEvent });

  const [confirm, setConfirm] = useState<"disable" | "enable" | null>(null);
  const [busy, setBusy] = useState(false);

  const data = provider.data;

  async function setEnabled(enabled: boolean) {
    if (!id) return;
    setBusy(true);
    try {
      await providersApi.update(id, { enabled });
      toast.success(enabled ? "Provider enabled." : "Provider disabled. Traffic routes to fallbacks.");
      provider.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function testConnection() {
    if (!id) return;
    setBusy(true);
    try {
      await providersApi.test(id);
      toast.success("Connection test queued — health refreshes with the result.");
      provider.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Test failed.");
    } finally {
      setBusy(false);
    }
  }

  const context: DangerActionContext | null =
    confirm && data
      ? {
          consequence:
            confirm === "disable"
              ? "The provider is removed from the routing rotation. Requests route to the next fallback until it is re-enabled."
              : "The provider is added back into the routing rotation.",
          target: data.name,
          environment: environmentLabel(),
          currentState: String(data.status).toLowerCase(),
        }
      : null;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title={data?.name ?? "Provider"}
        description={data ? `${data.provider_type} provider` : undefined}
        actions={
          <>
            <UpdatedAt at={data?.last_checked_at} />
            {canManage && data ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => void testConnection()} disabled={busy}>
                  Test connection
                </Button>
                {data.enabled ? (
                  <Button variant="destructive" size="sm" onClick={() => setConfirm("disable")}>
                    Disable
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setConfirm("enable")}>
                    Enable
                  </Button>
                )}
              </div>
            ) : null}
          </>
        }
      />

      {provider.error ? (
        <ErrorState message={provider.error} onRetry={provider.refresh} />
      ) : !data ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <SectionCard title="Overview">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <DetailField label="Status" value={<ProviderStatusBadge value={data.status} />} />
              <DetailField label="Health" value={data.health.toLowerCase()} />
              <DetailField label="Priority" value={data.priority ?? "—"} />
              <DetailField label="Scope" value={<ScopeBadge scope={data.scope} />} />
              <DetailField label="Requests" value={formatCount(data.requests)} />
              <DetailField label="Errors" value={formatCount(data.errors)} />
              <DetailField label="Latency" value={<LatencyStat stats={data.latency} />} />
              <DetailField label="Routing role" value={<RoutingRoleBadge value={data.routing_role} />} />
            </div>
          </SectionCard>

          <SectionCard
            title="Credentials metadata"
            description="Secrets stay server-side; only their state is displayed."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <DetailField label="State" value={<CredentialStateBadge value={data.credential_state} />} />
              <DetailField
                label="Masked identifier"
                value={<span className="font-mono">{data.credential_mask ?? "—"}</span>}
              />
              <DetailField label="Last checked" value={formatRelative(data.last_checked_at)} />
            </div>
          </SectionCard>

          {data.quota ? (
            <SectionCard title="Quota" description="Backend-configured limits and current utilization.">
              <UtilizationBar
                label={`${data.quota.unit ?? "requests"} used`}
                used={data.quota.used}
                limit={data.quota.limit}
                hint={
                  data.quota.reset_at
                    ? `Resets ${formatDateTime(data.quota.reset_at)} · ${formatCount(data.quota.remaining)} remaining`
                    : undefined
                }
              />
            </SectionCard>
          ) : null}

          <SectionCard title="Models" description="Models offered by this provider.">
            {data.models.length === 0 ? (
              <p className="text-xs text-muted-foreground">No models registered for this provider.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.models.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/ai/models/${m.id}`}
                      className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent/40"
                    >
                      <span className="truncate font-mono text-xs">{m.name}</span>
                      <span className="text-xs text-muted-foreground">{m.enabled ? "enabled" : "disabled"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Error breakdown" description="Categorised, retryability and fallback usage.">
            {data.error_breakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground">No errors recorded.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead>Last occurred</TableHead>
                    <TableHead>Retryable</TableHead>
                    <TableHead>Fallback used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.error_breakdown.map((e) => (
                    <TableRow key={e.category}>
                      <TableCell className="font-medium">{e.category.replace(/_/g, " ").toLowerCase()}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCount(e.count)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatRelative(e.last_occurred_at)}</TableCell>
                      <TableCell className="text-xs">{e.retryable ? "yes" : "no"}</TableCell>
                      <TableCell className="text-xs">{e.fallback_used ? "yes" : "no"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
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

      {context ? (
        <DangerActionDialog
          open={confirm !== null}
          onOpenChange={(open) => (open ? null : setConfirm(null))}
          actionLabel={confirm === "disable" ? "Disable provider" : "Enable provider"}
          context={context}
          onConfirm={() => void setEnabled(confirm === "disable" ? false : true)}
          loading={busy}
        />
      ) : null}
    </div>
  );
}

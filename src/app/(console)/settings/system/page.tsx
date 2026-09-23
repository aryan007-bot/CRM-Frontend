"use client";

/**
 * Configuration Center (spec §32 + §33 + §48).
 *
 * Safe configuration management: secrets show only "Configured ✓", production
 * changes require explicit confirmation showing current vs proposed values,
 * affected services, impact, restart/deployment requirements. The frontend
 * never assumes a change has applied — state refreshes from the backend.
 */

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState } from "@/components/page-states";
import { SectionCard, UpdatedAt } from "@/components/phase4/phase4-parts";
import { CredentialStateBadge } from "@/components/phase4/phase4-badges";
import { DangerActionDialog, type DangerActionContext } from "@/components/phase4/danger-action-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useApi } from "@/hooks/use-api";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/capabilities";
import { configurationApi } from "@/lib/phase4-api";
import { ApiError } from "@/lib/api";
import { configValueLabel, environmentLabel, isProductionEnvironment } from "@/lib/phase4-format";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import type { ConfigurationItem, ConfigurationDiffEntry } from "@/lib/phase4-types";

export default function SystemSettingsPage() {
  const { user } = useAuth();
  const canRead = can("configuration.read", user?.roles);
  const canManage = can("configuration.manage", user?.roles);

  const config = useApi(canRead ? () => configurationApi.list() : null, [canRead]);

  const [edits, setEdits] = useState<Record<string, string>>({});
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const data = config.data ?? [];

  const categories = useMemo(() => {
    const set = new Set(data.map((c) => c.category));
    return Array.from(set);
  }, [data]);

  const pendingItem = confirmKey ? data.find((c) => c.key === confirmKey) ?? null : null;
  const proposedValue = pendingItem ? edits[pendingItem.key] : undefined;

  const diffEntry: ConfigurationDiffEntry | null =
    pendingItem && proposedValue !== undefined && proposedValue !== ""
      ? {
          key: pendingItem.key,
          label: pendingItem.label,
          current: pendingItem.is_secret ? "(configured value)" : pendingItem.value,
          proposed: pendingItem.is_secret ? "(new secret — stored server-side)" : proposedValue,
          requires_restart: pendingItem.requires_restart,
          requires_deployment: pendingItem.requires_deployment,
          impact: pendingItem.impact,
        }
      : null;

  const context: DangerActionContext | null =
    pendingItem && diffEntry
      ? {
          consequence: `Update ${pendingItem.label} for ${pendingItem.environment ?? environmentLabel()}. ${pendingItem.impact ?? ""}`.trim(),
          target: pendingItem.key,
          environment: pendingItem.environment ?? environmentLabel(),
          currentState: configValueLabel(pendingItem),
        }
      : null;

  async function apply() {
    if (!pendingItem || proposedValue === undefined) return;
    setBusy(true);
    try {
      const raw = proposedValue;
      const value: string | number | boolean =
        raw === "true" ? true : raw === "false" ? false : /^\d+$/.test(raw) ? Number(raw) : raw;
      await configurationApi.update(pendingItem.key, { value });
      toast.success("Configuration saved. The backend confirms applied state.");
      setEdits((prev) => {
        const next = { ...prev };
        delete next[pendingItem.key];
        return next;
      });
      setConfirmKey(null);
      config.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save the configuration.");
    } finally {
      setBusy(false);
    }
  }

  if (!canRead) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader title="System Settings" />
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          You are not authorized to view configuration.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="System Settings"
        description="Platform configuration. Secret values never leave the backend — only their state is displayed."
        actions={<UpdatedAt at={null} />}
      />

      {isProductionEnvironment() ? (
        <p className="rounded-md border border-amber-600/30 bg-amber-600/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          You are viewing production configuration. Changes require confirmation and may require restart or deployment.
        </p>
      ) : null}

      {config.error ? (
        <ErrorState message={config.error} onRetry={config.refresh} />
      ) : config.loading && !config.data ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        categories.map((category) => (
          <SectionCard key={category} title={category}>
            <ul className="divide-y">
              {data
                .filter((c) => c.category === category)
                .map((item) => (
                  <ConfigRow
                    key={item.key}
                    item={item}
                    canManage={canManage}
                    editValue={edits[item.key]}
                    onEdit={(value) => setEdits((prev) => ({ ...prev, [item.key]: value }))}
                    onConfirm={() => setConfirmKey(item.key)}
                  />
                ))}
            </ul>
          </SectionCard>
        ))
      )}

      {diffEntry ? (
        <DangerActionDialog
          open={pendingItem !== null}
          onOpenChange={(open) => (open ? null : setConfirmKey(null))}
          actionLabel="Apply configuration change"
          context={context!}
          onConfirm={() => void apply()}
          loading={busy}
        >
          <div className="rounded-md border text-xs">
            <div className="grid grid-cols-2 gap-px bg-border">
              <div className="bg-card p-2.5">
                <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Current</p>
                <p className="mt-0.5 font-mono">{String(diffEntry.current)}</p>
              </div>
              <div className="bg-card p-2.5">
                <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Proposed</p>
                <p className="mt-0.5 font-mono font-semibold">{String(diffEntry.proposed)}</p>
              </div>
            </div>
            <div className="space-y-0.5 p-2.5">
              {diffEntry.requires_restart ? <p className="text-amber-700 dark:text-amber-400">Requires service restart.</p> : null}
              {diffEntry.requires_deployment ? <p className="text-amber-700 dark:text-amber-400">Requires deployment.</p> : null}
              {diffEntry.impact ? <p className="text-muted-foreground">{diffEntry.impact}</p> : null}
            </div>
          </div>
        </DangerActionDialog>
      ) : null}
    </div>
  );
}

function ConfigRow({
  item,
  canManage,
  editValue,
  onEdit,
  onConfirm,
}: {
  item: ConfigurationItem;
  canManage: boolean;
  editValue?: string;
  onEdit: (value: string) => void;
  onConfirm: () => void;
}) {
  const booleanValue = typeof item.value === "boolean" ? item.value : null;
  const changed = editValue !== undefined && editValue !== "" && String(item.value ?? "") !== editValue;

  return (
    <li className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {item.label}
          {item.requires_restart ? <span className="ml-2 text-[10px] text-muted-foreground">restart</span> : null}
          {item.requires_deployment ? <span className="ml-1 text-[10px] text-muted-foreground">deploy</span> : null}
        </p>
        <p className="text-xs text-muted-foreground">{item.description ?? item.key}</p>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{item.key}</p>
      </div>

      <div className="flex min-w-40 items-center justify-end gap-2">
        {item.is_secret ? (
          <CredentialStateBadge value={item.state} />
        ) : booleanValue !== null && item.state !== "MANAGED_EXTERNALLY" ? (
          canManage ? (
            <Switch checked={booleanValue} onCheckedChange={(v) => onEdit(String(v))} aria-label={item.label} />
          ) : (
            <span className="text-xs">{booleanValue ? "on" : "off"}</span>
          )
        ) : canManage && item.state !== "MANAGED_EXTERNALLY" && item.state !== "INHERITED" ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={editValue ?? (item.value === null ? "" : String(item.value))}
              onChange={(e) => onEdit(e.target.value)}
              className="h-8 w-36 font-mono text-xs"
              aria-label={item.label}
            />
            <Button size="sm" className="h-8" disabled={!changed} onClick={onConfirm}>
              Save
            </Button>
          </div>
        ) : (
          <span className="font-mono text-xs">{configValueLabel(item)}</span>
        )}
      </div>

      <div className="w-full sm:w-auto">
        <p className="text-right text-[10px] text-muted-foreground">
          {item.state.replace(/_/g, " ").toLowerCase()}
          {item.updated_at ? ` · ${formatDateTime(item.updated_at)}` : ""}
        </p>
      </div>
    </li>
  );
}

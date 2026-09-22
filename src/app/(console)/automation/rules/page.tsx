"use client";

/**
 * Automation rules list (spec §19) — manage WHEN/IF/THEN rules with
 * activation toggles and safe deletion.
 */

import { useState } from "react";
import Link from "next/link";
import { Plus, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { Pagination } from "@/components/pagination";
import { ConfirmActionDialog } from "@/components/ops";
import { Switch } from "@/components/ui/switch";
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
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { api, ApiError } from "@/lib/api";
import { can, type Capability } from "@/lib/capabilities";
import { formatRelative } from "@/lib/format";
import {
  AUTOMATION_ACTION_LABELS,
  AUTOMATION_TRIGGER_LABELS,
} from "@/lib/recovery";
import { useAuth } from "@/lib/auth";
import type { AutomationRule } from "@/lib/types";

export default function AutomationRulesPage() {
  const { user } = useAuth();
  const allowed = (capability: Capability) => can(capability, user?.roles);

  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [deleteTarget, setDeleteTarget] = useState<AutomationRule | null>(null);
  const [acting, setActing] = useState(false);

  const rules = useApi(() => api.listAutomationRules({ page, page_size: pageSize }), [page]);

  useRealtimeRefresh({ "follow-ups": rules.refresh }, { refreshMs: 0 });

  const data = rules.data ?? null;

  async function toggle(rule: AutomationRule, next: boolean) {
    try {
      await api.updateAutomationRule(rule.id, { is_active: next });
      toast.success(next ? "Rule activated." : "Rule paused.");
      rules.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update the rule.");
    }
  }

  async function runDelete() {
    if (!deleteTarget) return;
    setActing(true);
    try {
      await api.deleteAutomationRule(deleteTarget.id);
      toast.success("Rule deleted.");
      rules.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete the rule.");
    } finally {
      setActing(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Follow-up Rules</h1>
          <p className="text-sm text-muted-foreground">
            WHEN an event occurs → IF conditions match → THEN run an action.
          </p>
        </div>
        {allowed("automation.manage") ? (
          <Button asChild>
            <Link href="/automation/rules/new">
              <Plus className="size-4" />
              New rule
            </Link>
          </Button>
        ) : null}
      </header>

      <Card className="py-0">
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Last run</TableHead>
                  <TableHead>Next run</TableHead>
                  <TableHead className="text-right">Success rate</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.loading && !data ? (
                  <TableSkeleton rows={6} columns={9} />
                ) : rules.error ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <div className="p-4">
                        <ErrorState message={rules.error} onRetry={rules.refresh} />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : data && data.items.length === 0 ? (
                  <TableMessage
                    columns={9}
                    icon={Settings2}
                    title="No automation rules yet"
                    description="Create rules to automate retries, callbacks, escalations and verification workflows."
                    action={
                      allowed("automation.manage") ? (
                        <Button size="sm" asChild>
                          <Link href="/automation/rules/new">
                            <Plus className="size-4" />
                            New rule
                          </Link>
                        </Button>
                      ) : null
                    }
                  />
                ) : (
                  data?.items.map((rule) => {
                    const total = rule.success_count + rule.failure_count;
                    const successRate = total > 0 ? Math.round((rule.success_count / total) * 100) : null;
                    return (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <Link href={`/automation/rules/${rule.id}`} className="text-sm font-medium hover:underline">
                            {rule.name}
                          </Link>
                          {rule.conditions.length > 0 ? (
                            <p className="text-xs text-muted-foreground">
                              {rule.conditions.length} condition{rule.conditions.length === 1 ? "" : "s"}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-xs">
                          {AUTOMATION_TRIGGER_LABELS[rule.trigger] ?? rule.trigger}
                        </TableCell>
                        <TableCell className="text-xs">
                          {AUTOMATION_ACTION_LABELS[rule.action] ?? rule.action}
                        </TableCell>
                        <TableCell className="max-w-40 truncate text-xs">
                          {rule.campaign_name ?? "All campaigns"}
                        </TableCell>
                        <TableCell>
                          {allowed("automation.manage") ? (
                            <Switch
                              checked={rule.is_active}
                              onCheckedChange={(checked) => void toggle(rule, checked)}
                              aria-label={`${rule.is_active ? "Deactivate" : "Activate"} ${rule.name}`}
                            />
                          ) : (
                            <span className="text-xs">{rule.is_active ? "Active" : "Paused"}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatRelative(rule.last_run_at)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatRelative(rule.next_run_at)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {successRate === null ? "—" : `${successRate}%`}
                        </TableCell>
                        <TableCell>
                          {allowed("automation.manage") ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${rule.name}`}
                              onClick={() => setDeleteTarget(rule)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <Pagination
            page={data?.page ?? page}
            pageSize={data?.page_size ?? pageSize}
            total={data?.total ?? 0}
            onPageChange={setPage}
            disabled={rules.loading}
          />
        </CardContent>
      </Card>

      <ConfirmActionDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => (open ? null : setDeleteTarget(null))}
        title={`Delete rule "${deleteTarget?.name ?? ""}"?`}
        description="The rule stops running immediately. Existing follow-ups it created are not affected."
        confirmLabel="Delete rule"
        loading={acting}
        onConfirm={() => void runDelete()}
      />
    </div>
  );
}

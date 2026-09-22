"use client";

/**
 * Automation overview (spec §19) — rule health, upcoming actions and recent
 * executions across all automated follow-up workflows.
 */

import Link from "next/link";
import { Bot, XCircle } from "lucide-react";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { MetricRow } from "@/components/ops";
import { FollowUpStatusBadge } from "@/components/recovery-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { api } from "@/lib/api";
import { can, type Capability } from "@/lib/capabilities";
import { formatDateTime, formatRelative } from "@/lib/format";
import { useAuth } from "@/lib/auth";

export default function AutomationPage() {
  const { user } = useAuth();
  const allowed = (capability: Capability) => can(capability, user?.roles);

  const rules = useApi(() => api.listAutomationRules({ page_size: 100 }), []);
  const executions = useApi(() => api.listAutomationExecutions(1, 15), []);

  useRealtimeRefresh({ "follow-ups": executions.refresh }, { refreshMs: 45_000 });

  const ruleItems = rules.data?.items ?? [];
  const activeRules = ruleItems.filter((rule) => rule.is_active).length;
  const pausedRules = ruleItems.length - activeRules;
  const executionItems = executions.data?.items ?? [];
  const failedExecutions = executionItems.filter((e) => e.status.toUpperCase() === "FAILED").length;
  const upcoming = ruleItems
    .filter((rule) => rule.next_run_at !== null)
    .sort((a, b) => (a.next_run_at ?? "").localeCompare(b.next_run_at ?? ""))
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Automation</h1>
          <p className="text-sm text-muted-foreground">
            Rules that turn call outcomes into automatic follow-up actions.
          </p>
        </div>
        {allowed("automation.manage") ? (
          <Button asChild>
            <Link href="/automation/rules/new">New rule</Link>
          </Button>
        ) : null}
      </header>

      <div className="space-y-4">
        <MetricRow
          columns="grid-cols-2 sm:grid-cols-4"
          metrics={[
            { label: "Active rules", value: activeRules },
            { label: "Paused rules", value: pausedRules },
            {
              label: "Recent executions",
              value: executionItems.length,
              hint: "Latest 15 runs",
            },
            {
              label: "Failed executions",
              value: failedExecutions,
              hint: failedExecutions > 0 ? "Inspect the run log below" : undefined,
            },
          ]}
        />

        <Card>
          <CardHeader>
            <CardTitle>Upcoming actions</CardTitle>
            <CardDescription>Rules with their next scheduled evaluation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No scheduled rule runs. Rules trigger as soon as matching events occur.
              </p>
            ) : (
              upcoming.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <Link href={`/automation/rules/${rule.id}`} className="font-medium hover:underline">
                      {rule.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">{rule.action.replaceAll("_", " ")}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelative(rule.next_run_at)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardHeader className="border-b py-4">
            <CardTitle>Recent executions</CardTitle>
            <CardDescription>Latest automated runs across all rules.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.loading && !executions.data ? (
                  <TableSkeleton rows={5} columns={5} />
                ) : executions.error ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="p-4">
                        <ErrorState message={executions.error} onRetry={executions.refresh} />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : executionItems.length === 0 ? (
                  <TableMessage
                    columns={5}
                    icon={Bot}
                    title="No executions yet"
                    description="Rule runs will appear here as outcomes trigger them."
                  />
                ) : (
                  executionItems.map((execution) => (
                    <TableRow key={execution.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(execution.created_at)}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{execution.rule_name ?? "—"}</TableCell>
                      <TableCell className="text-sm">{execution.customer_name ?? "—"}</TableCell>
                      <TableCell><FollowUpStatusBadge value={execution.status} /></TableCell>
                      <TableCell className="max-w-64 truncate text-xs text-muted-foreground">
                        {execution.status.toUpperCase() === "FAILED" ? (
                          <span className="flex items-center gap-1 text-destructive">
                            <XCircle className="size-3.5" aria-hidden />
                            {execution.detail ?? "Execution failed"}
                          </span>
                        ) : (
                          execution.detail ?? "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

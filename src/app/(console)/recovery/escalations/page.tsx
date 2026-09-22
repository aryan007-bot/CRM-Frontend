"use client";

/**
 * Escalations (spec §16) — human review queue for conversations the AI could
 * not (or should not) handle. Operators assign, reassign and resolve.
 */

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { Pagination } from "@/components/pagination";
import { ConfirmActionDialog, FilterBar, SearchInput } from "@/components/ops";
import { EscalationStatusBadge, OutcomeBadge, PriorityBadge } from "@/components/recovery-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { api, ApiError } from "@/lib/api";
import { can, type Capability } from "@/lib/capabilities";
import { formatRelative, humanize } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import type { Escalation } from "@/lib/types";

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"];

export default function EscalationsPage() {
  const { user } = useAuth();
  const allowed = (capability: Capability) => can(capability, user?.roles);

  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [assignTarget, setAssignTarget] = useState<Escalation | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [resolveTarget, setResolveTarget] = useState<Escalation | null>(null);
  const [acting, setActing] = useState(false);

  const escalations = useApi(
    () =>
      api.listEscalations({
        status: status === "all" ? undefined : status,
        priority: priority === "all" ? undefined : priority,
        search: debounced || undefined,
        page,
        page_size: pageSize,
      }),
    [status, priority, debounced, page],
  );

  useRealtimeRefresh({ escalations: escalations.refresh });

  const data = escalations.data ?? null;

  async function runAssign() {
    if (!assignTarget || !assigneeId) return;
    setActing(true);
    try {
      await api.updateEscalation(assignTarget.id, {
        assigned_to: assigneeId,
        status: "IN_PROGRESS",
      });
      toast.success("Escalation assigned.");
      escalations.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not assign the escalation.");
    } finally {
      setActing(false);
      setAssignTarget(null);
    }
  }

  async function runResolve() {
    if (!resolveTarget) return;
    setActing(true);
    try {
      await api.updateEscalation(resolveTarget.id, { status: "RESOLVED" });
      toast.success("Escalation marked resolved.");
      escalations.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not resolve the escalation.");
    } finally {
      setActing(false);
      setResolveTarget(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Escalations</h1>
        <p className="text-sm text-muted-foreground">
          Conversations requiring human judgement — requested by the customer, flagged by the
          AI, or triggered by policy.
        </p>
      </header>

      <Card className="py-0">
        <CardContent className="px-0">
          <FilterBar
            right={
              <span className="text-xs text-muted-foreground tabular-nums">
                {data ? `${data.total} escalations` : "Loading…"}
              </span>
            }
          >
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-40" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={(v) => { setPriority(v); setPage(1); }}>
              <SelectTrigger className="w-36" aria-label="Filter by priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(1); }}
              placeholder="Search customer…"
            />
          </FilterBar>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>AI disposition</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Assigned to</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-44" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {escalations.loading && !data ? (
                  <TableSkeleton rows={8} columns={9} />
                ) : escalations.error ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <div className="p-4">
                        <ErrorState message={escalations.error} onRetry={escalations.refresh} />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : data && data.items.length === 0 ? (
                  <TableMessage
                    columns={9}
                    icon={AlertTriangle}
                    title="No escalations open"
                    description="Items escalated by AI conversations or policy triggers appear here."
                  />
                ) : (
                  data?.items.map((escalation) => (
                    <TableRow key={escalation.id}>
                      <TableCell className="text-sm font-medium">
                        {escalation.customer_name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Link href={`/accounts/${escalation.account_id}`} className="font-mono text-xs hover:underline">
                          {escalation.account_number ?? escalation.account_id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">{humanize(escalation.reason.toLowerCase())}</TableCell>
                      <TableCell><OutcomeBadge value={escalation.ai_disposition} /></TableCell>
                      <TableCell><PriorityBadge value={escalation.priority} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatRelative(escalation.created_at)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {escalation.assigned_name ?? "Unassigned"}
                      </TableCell>
                      <TableCell><EscalationStatusBadge value={escalation.status} /></TableCell>
                      <TableCell>
                        {allowed("escalation.manage") ? (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setAssignTarget(escalation);
                                setAssigneeId(escalation.assigned_to ?? "");
                              }}
                            >
                              {escalation.assigned_to ? "Reassign" : "Assign"}
                            </Button>
                            {escalation.status.toUpperCase() !== "RESOLVED" &&
                            escalation.status.toUpperCase() !== "CLOSED" ? (
                              <Button variant="ghost" size="sm" onClick={() => setResolveTarget(escalation)}>
                                Resolve
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <Pagination
            page={data?.page ?? page}
            pageSize={data?.page_size ?? pageSize}
            total={data?.total ?? 0}
            onPageChange={setPage}
            disabled={escalations.loading}
          />
        </CardContent>
      </Card>

      <AssignDialog
        open={assignTarget !== null}
        onOpenChange={(open) => (open ? null : setAssignTarget(null))}
        escalation={assignTarget}
        assigneeId={assigneeId}
        onAssigneeChange={setAssigneeId}
        loading={acting}
        onConfirm={() => void runAssign()}
      />

      <ConfirmActionDialog
        open={resolveTarget !== null}
        onOpenChange={(open) => (open ? null : setResolveTarget(null))}
        title="Mark this escalation resolved?"
        description="The item leaves the active review queue. The resolution is recorded in the audit trail."
        confirmLabel="Mark resolved"
        destructive={false}
        loading={acting}
        onConfirm={() => void runResolve()}
      />
    </div>
  );
}

function AssignDialog({
  open,
  onOpenChange,
  escalation,
  assigneeId,
  onAssigneeChange,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  escalation: Escalation | null;
  assigneeId: string;
  onAssigneeChange: (id: string) => void;
  loading: boolean;
  onConfirm: () => void;
}) {
  const users = useApi(open ? () => api.listUsers() : null, [open]);
  const options = users.data?.items ?? [];

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Assign ${escalation?.customer_name ?? "escalation"}`}
      description="Pick the team member who will handle this review. They will see it in their queue."
      confirmLabel="Assign"
      destructive={false}
      loading={loading}
      onConfirm={onConfirm}
    >
      <div className="py-2">
        <Select value={assigneeId} onValueChange={onAssigneeChange}>
          <SelectTrigger aria-label="Assignee">
            <SelectValue placeholder="Choose a team member" />
          </SelectTrigger>
          <SelectContent>
            {options.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="hidden" />
      </div>
    </ConfirmActionDialog>
  );
}

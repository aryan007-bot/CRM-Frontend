"use client";

/**
 * Disputes (spec §15) — disputes captured during recovery conversations.
 * AI-generated classifications are always labelled as AI signals until a
 * human reviewer confirms them (spec §48).
 */

import { useState } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { Pagination } from "@/components/pagination";
import { ConfirmActionDialog, FilterBar, SearchInput } from "@/components/ops";
import { DisputeStatusBadge } from "@/components/recovery-badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { formatDateTime, humanize } from "@/lib/format";
import { DISPUTE_TYPES } from "@/lib/recovery";
import { useAuth } from "@/lib/auth";
import type { Dispute } from "@/lib/types";

const STATUSES = ["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED", "ESCALATED"];

export default function DisputesPage() {
  const { user } = useAuth();
  const allowed = (capability: Capability) => can(capability, user?.roles);

  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [target, setTarget] = useState<{ dispute: Dispute; next: string } | null>(null);
  const [acting, setActing] = useState(false);

  const disputes = useApi(
    () =>
      api.listDisputes({
        status: status === "all" ? undefined : status,
        dispute_type: type === "all" ? undefined : type,
        search: debounced || undefined,
        page,
        page_size: pageSize,
      }),
    [status, type, debounced, page],
  );

  useRealtimeRefresh({ disputes: disputes.refresh });

  const data = disputes.data ?? null;

  async function applyStatus(next: string) {
    if (!target) return;
    setActing(true);
    try {
      await api.updateDispute(target.dispute.id, { status: next });
      toast.success(`Dispute marked ${humanize(next.toLowerCase())}.`);
      disputes.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update the dispute.");
    } finally {
      setActing(false);
      setTarget(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Disputes</h1>
        <p className="text-sm text-muted-foreground">
          Disputes captured by AI conversations. AI classifications are signals — a human
          reviewer must confirm them before they are treated as facts.
        </p>
      </header>

      <Card className="py-0">
        <CardContent className="px-0">
          <FilterBar
            right={
              <span className="text-xs text-muted-foreground tabular-nums">
                {data ? `${data.total} disputes` : "Loading…"}
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
            <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
              <SelectTrigger className="w-44" aria-label="Filter by dispute type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {DISPUTE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{humanize(t.toLowerCase())}</SelectItem>
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
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>AI signal</TableHead>
                  <TableHead>Assigned to</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {disputes.loading && !data ? (
                  <TableSkeleton rows={8} columns={9} />
                ) : disputes.error ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <div className="p-4">
                        <ErrorState message={disputes.error} onRetry={disputes.refresh} />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : data && data.items.length === 0 ? (
                  <TableMessage
                    columns={9}
                    icon={ShieldAlert}
                    title="No disputes recorded"
                    description="Disputes raised during AI conversations will appear here for human review."
                  />
                ) : (
                  data?.items.map((dispute) => (
                    <TableRow key={dispute.id}>
                      <TableCell className="text-sm font-medium">
                        {dispute.customer_name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Link href={`/accounts/${dispute.account_id}`} className="font-mono text-xs hover:underline">
                          {dispute.account_number ?? dispute.account_id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">
                        {humanize(dispute.dispute_type.toLowerCase())}
                      </TableCell>
                      <TableCell className="max-w-56 truncate text-xs text-muted-foreground">
                        {dispute.description ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(dispute.created_at)}
                      </TableCell>
                      <TableCell>
                        {dispute.ai_classified ? (
                          <Badge variant="outline" className="bg-amber-600/10 text-amber-700 dark:text-amber-400">
                            AI-generated
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-emerald-600/10 text-emerald-700 dark:text-emerald-400">
                            Human-confirmed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{dispute.assigned_name ?? "Unassigned"}</TableCell>
                      <TableCell><DisputeStatusBadge value={dispute.status} /></TableCell>
                      <TableCell>
                        {allowed("dispute.manage") ? (
                          <Select
                            value={dispute.status.toUpperCase()}
                            onValueChange={(next) => setTarget({ dispute, next })}
                          >
                            <SelectTrigger size="sm" aria-label={`Update dispute for ${dispute.customer_name ?? "customer"}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>{humanize(s.toLowerCase())}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
            disabled={disputes.loading}
          />
        </CardContent>
      </Card>

      <ConfirmActionDialog
        open={target !== null}
        onOpenChange={(open) => (open ? null : setTarget(null))}
        title="Update dispute status?"
        description={`Status will change to ${humanize(target?.next.toLowerCase() ?? "")}. The change is recorded in the audit trail.`}
        confirmLabel="Update status"
        loading={acting}
        onConfirm={() => void applyStatus(target?.next ?? "")}
      />
    </div>
  );
}

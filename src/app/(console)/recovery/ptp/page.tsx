"use client";

/**
 * Promise to Pay (spec §12) — dedicated PTP management. Promises recorded
 * from conversations are always shown as unverified customer statements until
 * a payment is confirmed by the backend.
 */

import { useState } from "react";
import Link from "next/link";
import { Handshake } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { Pagination } from "@/components/pagination";
import { ConfirmActionDialog, DetailField, FilterBar, SearchInput, VerificationCallout } from "@/components/ops";
import { PtpStatusBadge } from "@/components/recovery-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { formatDate, formatDateTime, formatMoney, formatRelative } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import type { PromiseToPay } from "@/lib/types";

const STATUSES = ["PENDING", "CONFIRMED", "DUE", "PAID", "BROKEN", "CANCELLED"];

export default function PtpPage() {
  const { user } = useAuth();
  const allowed = (capability: Capability) => can(capability, user?.roles);

  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [detail, setDetail] = useState<PromiseToPay | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<{ ptp: PromiseToPay; next: string } | null>(null);
  const [acting, setActing] = useState(false);

  const ptps = useApi(
    () =>
      api.listPtp({
        status: status === "all" ? undefined : status,
        search: debounced || undefined,
        page,
        page_size: pageSize,
      }),
    [status, debounced, page],
  );

  useRealtimeRefresh({ ptp: ptps.refresh });

  const data = ptps.data ?? null;

  async function applyStatus(next: string) {
    if (!confirmStatus) return;
    setActing(true);
    try {
      await api.updatePtp(confirmStatus.ptp.id, { status: next });
      toast.success(`PTP marked as ${next.toLowerCase()}.`);
      ptps.refresh();
      setDetail(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update the PTP.");
    } finally {
      setActing(false);
      setConfirmStatus(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Promise to Pay</h1>
        <p className="text-sm text-muted-foreground">
          Promises captured by AI conversations. A promise is the customer&apos;s stated intention —
          it is never treated as a payment.
        </p>
      </header>

      <Card className="py-0">
        <CardContent className="px-0">
          <FilterBar
            right={
              <span className="text-xs text-muted-foreground tabular-nums">
                {data ? `${data.total} promises` : "Loading…"}
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
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(1); }}
              placeholder="Search customer or account…"
            />
          </FilterBar>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Promised</TableHead>
                  <TableHead>Promise date</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last contact</TableHead>
                  <TableHead>Follow-up</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ptps.loading && !data ? (
                  <TableSkeleton rows={8} columns={10} />
                ) : ptps.error ? (
                  <TableRow>
                    <TableCell colSpan={10}>
                      <div className="p-4">
                        <ErrorState message={ptps.error} onRetry={ptps.refresh} />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : data && data.items.length === 0 ? (
                  <TableMessage
                    columns={10}
                    icon={Handshake}
                    title="No promises to pay recorded"
                    description="PTPs appear here when customers commit to a payment during a call."
                  />
                ) : (
                  data?.items.map((ptp) => (
                    <TableRow key={ptp.id}>
                      <TableCell>
                        <button type="button" className="text-sm font-medium hover:underline" onClick={() => setDetail(ptp)}>
                          {ptp.customer_name ?? "—"}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Link href={`/accounts/${ptp.account_id}`} className="font-mono text-xs hover:underline">
                          {ptp.account_number ?? ptp.account_id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(ptp.outstanding_amount)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatMoney(ptp.promised_amount)}
                      </TableCell>
                      <TableCell className="text-xs">{formatDate(ptp.promised_date)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(ptp.created_at)}
                      </TableCell>
                      <TableCell className="text-xs">{ptp.source ?? "ai_call"}</TableCell>
                      <TableCell><PtpStatusBadge value={ptp.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {ptp.last_contact_at ? formatRelative(ptp.last_contact_at) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {ptp.follow_up_at ? formatDateTime(ptp.follow_up_at) : "—"}
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
            disabled={ptps.loading}
          />
        </CardContent>
      </Card>

      {/* PTP detail panel */}
      <Sheet open={detail !== null} onOpenChange={(open) => (open ? undefined : setDetail(null))}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {detail ? (
            <>
              <SheetHeader>
                <SheetTitle>{detail.customer_name ?? "Customer"}</SheetTitle>
                <SheetDescription>
                  Account {detail.account_number ?? detail.account_id.slice(0, 8)}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-8">
                <div className="grid grid-cols-2 gap-3">
                  <DetailField label="Original outstanding" value={formatMoney(detail.outstanding_amount)} />
                  <DetailField label="Promised amount" value={formatMoney(detail.promised_amount)} />
                  <DetailField label="Promise date" value={formatDate(detail.promised_date)} />
                  <DetailField label="Source" value={detail.source ?? "ai_call"} />
                  <DetailField label="Created" value={formatDateTime(detail.created_at)} />
                  <DetailField label="Last contact" value={formatDateTime(detail.last_contact_at)} />
                </div>

                <VerificationCallout
                  signal="Promise to Pay"
                  verified={detail.status.toUpperCase() === "PAID"}
                />

                {detail.notes ? (
                  <div>
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p className="text-sm">{detail.notes}</p>
                  </div>
                ) : null}

                {detail.call_id ? (
                  <p className="text-xs text-muted-foreground">
                    Call reference:{" "}
                    <Link className="underline" href={`/live-calls/${detail.call_id}`}>
                      {detail.call_id.slice(0, 8)}
                    </Link>{" "}
                    ·{" "}
                    <Link className="underline" href="/call-analysis">
                      open call analysis
                    </Link>
                  </p>
                ) : null}

                {allowed("ptp.manage") ? (
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    {["CONFIRMED", "PAID", "BROKEN", "CANCELLED"].map((next) => (
                      <Button
                        key={next}
                        variant="outline"
                        size="sm"
                        disabled={detail.status.toUpperCase() === next}
                        onClick={() => setConfirmStatus({ ptp: detail, next })}
                      >
                        Mark {next.toLowerCase()}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <ConfirmActionDialog
        open={confirmStatus !== null}
        onOpenChange={(open) => (open ? null : setConfirmStatus(null))}
        title={`Mark PTP as ${confirmStatus?.next.toLowerCase() ?? ""}?`}
        description={
          confirmStatus?.next === "PAID"
            ? "Only mark PAID when a payment has been verified by the backend — a customer statement is not proof of payment."
            : "The PTP status will be updated and an audit entry recorded."
        }
        confirmLabel="Update status"
        loading={acting}
        onConfirm={() => void applyStatus(confirmStatus?.next ?? "")}
      />
    </div>
  );
}

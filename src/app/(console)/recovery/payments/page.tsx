"use client";

/**
 * Payment intents (spec §13) — monitoring screen separating conversational
 * intent (what the AI heard) from actual verified payment state.
 */

import { useState } from "react";
import Link from "next/link";
import { Landmark } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { Pagination } from "@/components/pagination";
import { DetailField, FilterBar, SearchInput, VerificationCallout } from "@/components/ops";
import { PaymentIntentBadge } from "@/components/recovery-badges";
import { PaymentStatusBadge } from "@/components/status-badges";
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
import { formatDate, formatMoney } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import type { PaymentIntent } from "@/lib/types";

const INTENTS = [
  "UNKNOWN",
  "NO_INTENT",
  "PARTIAL_PAYMENT",
  "FULL_PAYMENT",
  "PROMISE_TO_PAY",
  "ALREADY_PAID",
  "PAYMENT_PENDING_VERIFICATION",
];

export default function PaymentIntentsPage() {
  const { user } = useAuth();
  const allowed = (capability: Capability) => can(capability, user?.roles);

  const [intent, setIntent] = useState("all");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [detail, setDetail] = useState<PaymentIntent | null>(null);
  const [acting, setActing] = useState(false);

  const intents = useApi(
    () =>
      api.listPaymentIntents({
        intent: intent === "all" ? undefined : intent,
        search: debounced || undefined,
        page,
        page_size: pageSize,
      }),
    [intent, debounced, page],
  );

  useRealtimeRefresh({ intents: intents.refresh });

  const data = intents.data ?? null;

  async function requestVerification() {
    if (!detail) return;
    setActing(true);
    try {
      await api.requestPaymentVerification(detail.id);
      toast.success("Verification requested. The backend will reconcile with payment records.");
      intents.refresh();
      setDetail(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not request verification.");
    } finally {
      setActing(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Payment Intent</h1>
        <p className="text-sm text-muted-foreground">
          What customers said about payment during calls, tracked separately from verified
          payment state.
        </p>
      </header>

      <Card className="py-0">
        <CardContent className="px-0">
          <FilterBar
            right={
              <span className="text-xs text-muted-foreground tabular-nums">
                {data ? `${data.total} records` : "Loading…"}
              </span>
            }
          >
            <Select value={intent} onValueChange={(v) => { setIntent(v); setPage(1); }}>
              <SelectTrigger className="w-48" aria-label="Filter by intent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All intents</SelectItem>
                {INTENTS.map((i) => (
                  <SelectItem key={i} value={i}>{i.replaceAll("_", " ")}</SelectItem>
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
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead className="text-right">Amount mentioned</TableHead>
                  <TableHead>Expected date</TableHead>
                  <TableHead>Payment state</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {intents.loading && !data ? (
                  <TableSkeleton rows={8} columns={9} />
                ) : intents.error ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <div className="p-4">
                        <ErrorState message={intents.error} onRetry={intents.refresh} />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : data && data.items.length === 0 ? (
                  <TableMessage
                    columns={9}
                    icon={Landmark}
                    title="No payment intents recorded"
                    description="Intent signals captured during AI conversations appear here."
                  />
                ) : (
                  data?.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <button type="button" className="text-sm font-medium hover:underline" onClick={() => setDetail(item)}>
                          {item.customer_name ?? "—"}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Link href={`/accounts/${item.account_id}`} className="font-mono text-xs hover:underline">
                          {item.account_number ?? item.account_id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(item.outstanding_amount)}
                      </TableCell>
                      <TableCell><PaymentIntentBadge value={item.intent} /></TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.amount_mentioned ? formatMoney(item.amount_mentioned) : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{formatDate(item.expected_payment_date)}</TableCell>
                      <TableCell>
                        {item.payment_state ? (
                          <PaymentStatusBadge status={item.payment_state} />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.payment_verified === null || item.payment_verified === undefined
                          ? "—"
                          : item.payment_verified
                            ? "Verified"
                            : "Pending"}
                      </TableCell>
                      <TableCell className="text-xs">{item.status}</TableCell>
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
            disabled={intents.loading}
          />
        </CardContent>
      </Card>

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
                  <DetailField label="Outstanding" value={formatMoney(detail.outstanding_amount)} />
                  <DetailField label="Amount mentioned" value={detail.amount_mentioned ? formatMoney(detail.amount_mentioned) : "—"} />
                  <DetailField label="Expected date" value={formatDate(detail.expected_payment_date)} />
                  <DetailField label="Source" value={detail.source ?? "ai_call"} />
                </div>

                <VerificationCallout
                  signal={detail.intent.replaceAll("_", " ").toLowerCase()}
                  verified={detail.payment_verified}
                />

                <div>
                  <p className="text-xs text-muted-foreground">Actual payment state</p>
                  <div className="mt-1">
                    {detail.payment_state ? (
                      <PaymentStatusBadge status={detail.payment_state} />
                    ) : (
                      <span className="text-sm">No payment recorded</span>
                    )}
                  </div>
                </div>

                {detail.call_id ? (
                  <p className="text-xs text-muted-foreground">
                    Source call:{" "}
                    <Link className="underline" href={`/live-calls/${detail.call_id}`}>
                      {detail.call_id.slice(0, 8)}
                    </Link>
                  </p>
                ) : null}

                {allowed("recovery.manage") &&
                detail.intent.toUpperCase() === "ALREADY_PAID" &&
                !detail.payment_verified ? (
                  <Button onClick={() => void requestVerification()} disabled={acting} className="w-full">
                    Request payment verification
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

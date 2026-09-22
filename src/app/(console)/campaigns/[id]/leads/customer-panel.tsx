"use client";

/**
 * Customer recovery workspace side panel (spec §10).
 *
 * Everything shown comes from the authoritative backend records (account,
 * payments, calls, recovery state). The panel is read-only presentation.
 */

import Link from "next/link";
import { FileAudio, FileText } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DetailField, VerificationCallout } from "@/components/ops";
import {
  CallbackStatusBadge,
  DisputeStatusBadge,
  OutcomeBadge,
  PaymentIntentBadge,
  PtpStatusBadge,
} from "@/components/recovery-badges";
import { PaymentStatusBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/page-states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { formatDate, formatDateTime, formatDuration, formatMoney, formatRelative } from "@/lib/format";
import type { CampaignLeadDetail } from "@/lib/types";

export function CustomerRecoveryPanel({
  lead,
  onClose,
}: {
  lead: CampaignLeadDetail | null;
  onClose: () => void;
}) {
  const account = useApi(
    lead ? () => api.getAccount(lead.account_id) : null,
    [lead?.account_id],
  );

  const calls = useApi(
    lead ? () => api.listLiveCalls(undefined, 1, 25) : null,
    [lead?.account_id],
  );

  const accountData = account.data;

  return (
    <Sheet open={lead !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {lead ? (
          <>
            <SheetHeader>
              <SheetTitle>{lead.customer_name ?? "Customer"}</SheetTitle>
              <SheetDescription>
                Account {lead.account_number ?? lead.account_id.slice(0, 8)} ·{" "}
                {lead.creditor_name ?? "—"}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-8">
              {account.error ? (
                <ErrorState message={account.error} onRetry={account.refresh} compact />
              ) : null}

              {/* Account */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Account
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <DetailField
                    label="Outstanding"
                    value={
                      accountData ? formatMoney(accountData.outstanding_amount, accountData.currency) : "—"
                    }
                  />
                  <DetailField label="Due date" value={formatDate(accountData?.due_date)} />
                  <DetailField label="Status" value={accountData?.status ?? "—"} />
                  <DetailField
                    label="Creditor"
                    value={accountData?.creditor_name ?? lead.creditor_name ?? "—"}
                  />
                </div>
              </section>

              {/* Recovery state */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Recovery state
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  <PaymentIntentBadge value={lead.metrics?.payment_intent ?? undefined} />
                  <PtpStatusBadge value={lead.metrics?.ptp_status ?? undefined} />
                  <CallbackStatusBadge value={lead.metrics?.callback_status ?? undefined} />
                  <DisputeStatusBadge value={lead.metrics?.dispute_status ?? undefined} />
                  <OutcomeBadge value={lead.metrics?.last_outcome ?? undefined} />
                </div>
                <VerificationCallout
                  signal={lead.metrics?.payment_intent ?? "no intent recorded"}
                  verified={lead.metrics?.payment_intent ? false : undefined}
                />
                <p className="text-xs text-muted-foreground">
                  Attempts so far: <span className="font-medium tabular-nums">{lead.metrics?.attempts ?? 0}</span>
                  {lead.last_attempt_at ? ` · last ${formatRelative(lead.last_attempt_at)}` : ""}
                </p>
              </section>

              {/* Payment history */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Payment history
                </h3>
                {accountData && accountData.payments.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accountData.payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="text-xs">{formatDate(payment.payment_date)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(payment.amount, payment.currency)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{payment.reference ?? "—"}</TableCell>
                          <TableCell><PaymentStatusBadge status={payment.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    No payments recorded on this account yet.
                  </p>
                )}
              </section>

              {/* Call history */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Call history
                </h3>
                {calls.error ? (
                  <ErrorState message={calls.error} onRetry={calls.refresh} compact />
                ) : calls.data && calls.data.items.length > 0 ? (
                  <ul className="space-y-2">
                    {calls.data.items.slice(0, 8).map((call) => (
                      <li key={call.id} className="rounded-lg border p-2.5 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(call.start_time ?? call.created_at)}
                          </span>
                          <OutcomeBadge value={call.disposition ?? undefined} />
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{formatDuration(call.duration_seconds)}</span>
                          {call.status === "ended" ? (
                            <Badge variant="outline" className="gap-1">
                              <FileText className="size-3" aria-hidden /> transcript
                            </Badge>
                          ) : null}
                          <span className="flex items-center gap-1">
                            <FileAudio className="size-3" aria-hidden /> recording
                          </span>
                          <Link href={`/live-calls/${call.id}`} className="ml-auto underline">
                            Open call
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    No calls recorded for this customer yet.
                  </p>
                )}
              </section>

              <p className="text-xs text-muted-foreground">
                Full customer record:{" "}
                <Link className="underline" href={`/customers/${accountData?.customer_id ?? ""}`}>
                  open customer
                </Link>
              </p>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

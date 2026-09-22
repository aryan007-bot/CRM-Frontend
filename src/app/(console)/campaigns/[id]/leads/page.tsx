"use client";

/**
 * Campaign Leads tab (spec §9, §10) — server-driven table with filters,
 * row selection + bulk actions, and a customer recovery side panel.
 */

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Pause, Play, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { Pagination } from "@/components/pagination";
import { ConfirmActionDialog, FilterBar, SearchInput } from "@/components/ops";
import {
  DisputeStatusBadge,
  OutcomeBadge,
  PaymentIntentBadge,
  PtpStatusBadge,
  Phase3LeadStatusBadge,
  CallbackStatusBadge,
} from "@/components/recovery-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { api, ApiError } from "@/lib/api";
import { can, type Capability } from "@/lib/capabilities";
import { formatDate, formatMoney } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import type { CampaignLeadDetail } from "@/lib/types";
import { CustomerRecoveryPanel } from "./customer-panel";

const OUTCOMES = [
  "NO_ANSWER",
  "BUSY",
  "FAILED",
  "CALLBACK",
  "PROMISE_TO_PAY",
  "PAYMENT_INTENT",
  "ALREADY_PAID",
  "REFUSED",
  "DISPUTE",
  "HARDSHIP",
  "WRONG_NUMBER",
  "ESCALATED",
];

export default function CampaignLeadsPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params?.id;
  const { user } = useAuth();
  const allowed = (capability: Capability) => can(capability, user?.roles);

  const [status, setStatus] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [ptp, setPtp] = useState("all");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [selected, setSelected] = useState<string[]>([]);
  const [panelLead, setPanelLead] = useState<CampaignLeadDetail | null>(null);
  const [confirm, setConfirm] = useState<"remove" | "pause" | "resume" | null>(null);
  const [acting, setActing] = useState(false);

  const leads = useApi(
    campaignId
      ? () =>
          api.listCampaignLeadsV3(campaignId, {
            status: status === "all" ? undefined : status.toLowerCase(),
            outcome: outcome === "all" ? undefined : outcome,
            ptp_status: ptp === "all" ? undefined : ptp,
            search: debounced || undefined,
            page,
            page_size: pageSize,
          })
      : null,
    [campaignId, status, outcome, ptp, debounced, page],
  );

  const data = leads.data ?? null;
  const allChecked =
    data !== null &&
    data.items.length > 0 &&
    data.items.every((lead) => selected.includes(lead.id));

  function toggleAll() {
    if (data === null) return;
    setSelected(allChecked ? [] : data.items.map((lead) => lead.id));
  }

  async function runBulk(action: "remove" | "pause" | "resume" | "queue") {
    if (!campaignId || selected.length === 0) return;
    setActing(true);
    try {
      const result = await api.bulkCampaignLeadAction(campaignId, action === "queue" ? "add_to_queue" : action, selected);
      toast.success(`${result.updated} lead(s) updated.`);
      setSelected([]);
      leads.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Bulk action failed.");
    } finally {
      setActing(false);
      setConfirm(null);
    }
  }

  return (
    <Card className="py-0">
      <CardContent className="px-0">
        <FilterBar
          right={
            <>
              {allowed("recovery.manage") && selected.length > 0 ? (
                <>
                  <span className="text-xs text-muted-foreground">{selected.length} selected</span>
                  <Button variant="outline" size="sm" onClick={() => setConfirm("pause")}>
                    <Pause className="size-3.5" /> Pause
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setConfirm("resume")}>
                    <Play className="size-3.5" /> Resume
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setConfirm("remove")}>
                    <Trash2 className="size-3.5" /> Remove
                  </Button>
                </>
              ) : null}
              <span className="text-xs text-muted-foreground tabular-nums">
                {data ? `${data.total} leads` : "Loading…"}
              </span>
            </>
          }
        >
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search customer or account…"
          />
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-36" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {["PENDING", "QUEUED", "IN_PROGRESS", "CALLBACK", "FOLLOW_UP", "COMPLETED", "PAUSED", "SKIPPED", "FAILED"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={outcome} onValueChange={(v) => { setOutcome(v); setPage(1); }}>
            <SelectTrigger className="w-40" aria-label="Filter by last outcome">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All outcomes</SelectItem>
              {OUTCOMES.map((o) => (
                <SelectItem key={o} value={o}>{o.replaceAll("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={ptp} onValueChange={(v) => { setPtp(v); setPage(1); }}>
            <SelectTrigger className="w-36" aria-label="Filter by PTP status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All PTP</SelectItem>
              {["PENDING", "CONFIRMED", "DUE", "PAID", "BROKEN", "CANCELLED"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-9">
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={toggleAll}
                    aria-label="Select all leads on this page"
                  />
                </TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Attempts</TableHead>
                <TableHead>Last outcome</TableHead>
                <TableHead>Intent</TableHead>
                <TableHead>PTP</TableHead>
                <TableHead>Callback</TableHead>
                <TableHead>Dispute</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.loading && !data ? (
                <TableSkeleton rows={6} columns={13} />
              ) : leads.error ? (
                <TableRow>
                  <TableCell colSpan={13}>
                    <div className="p-4">
                      <ErrorState message={leads.error} onRetry={leads.refresh} />
                    </div>
                  </TableCell>
                </TableRow>
              ) : data && data.items.length === 0 ? (
                <TableMessage
                  columns={13}
                  icon={Users}
                  title="No leads match these filters"
                  description="Add accounts from the Overview tab or adjust filters."
                />
              ) : (
                data?.items.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.includes(lead.id)}
                        onCheckedChange={() =>
                          setSelected((current) =>
                            current.includes(lead.id)
                              ? current.filter((id) => id !== lead.id)
                              : [...current, lead.id],
                          )
                        }
                        aria-label={`Select ${lead.customer_name ?? lead.account_number ?? lead.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="text-sm font-medium hover:underline"
                        onClick={() => setPanelLead(lead)}
                      >
                        {lead.customer_name ?? "—"}
                      </button>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{lead.phone ?? "—"}</TableCell>
                    <TableCell>
                      <Link href={`/accounts/${lead.account_id}`} className="font-mono text-xs hover:underline">
                        {lead.account_number ?? lead.account_id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {lead.outstanding_amount ? formatMoney(lead.outstanding_amount) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{formatDate(lead.due_date)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {lead.metrics?.attempts ?? 0}
                    </TableCell>
                    <TableCell>
                      <OutcomeBadge value={lead.metrics?.last_outcome ?? undefined} />
                    </TableCell>
                    <TableCell>
                      <PaymentIntentBadge value={lead.metrics?.payment_intent ?? undefined} />
                    </TableCell>
                    <TableCell>
                      <PtpStatusBadge value={lead.metrics?.ptp_status ?? undefined} />
                    </TableCell>
                    <TableCell>
                      <CallbackStatusBadge value={lead.metrics?.callback_status ?? undefined} />
                    </TableCell>
                    <TableCell>
                      <DisputeStatusBadge value={lead.metrics?.dispute_status ?? undefined} />
                    </TableCell>
                    <TableCell><Phase3LeadStatusBadge value={lead.status} /></TableCell>
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
          disabled={leads.loading}
        />
      </CardContent>

      <CustomerRecoveryPanel
        lead={panelLead}
        onClose={() => setPanelLead(null)}
      />

      <ConfirmActionDialog
        open={confirm !== null}
        onOpenChange={(open) => (open ? null : setConfirm(null))}
        title={
          confirm === "remove"
            ? `Remove ${selected.length} lead(s)?`
            : confirm === "pause"
              ? `Pause ${selected.length} lead(s)?`
              : `Resume ${selected.length} lead(s)?`
        }
        description={
          confirm === "remove"
            ? "Removed leads leave the campaign but keep their outcomes and history."
            : confirm === "pause"
              ? "Paused leads are skipped by the dialer until resumed."
              : "Resumed leads re-enter the dialing queue under the campaign's retry policy."
        }
        confirmLabel={confirm === "remove" ? "Remove" : confirm === "pause" ? "Pause leads" : "Resume leads"}
        destructive={confirm === "remove"}
        loading={acting}
        onConfirm={() => {
          if (confirm) void runBulk(confirm);
        }}
      />
    </Card>
  );
}

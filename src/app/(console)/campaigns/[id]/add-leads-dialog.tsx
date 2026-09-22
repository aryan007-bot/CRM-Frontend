"use client";

/**
 * "Add accounts to campaign" dialog — extracted from the original Phase 1
 * campaign detail page so both the Overview tab and the E2E flow can reuse it.
 */

import { useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/page-states";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { api, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";

function LeadPicker({
  campaignId,
  onOpenChange,
  onAdded,
}: {
  campaignId: string;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}) {
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounced = useDebouncedValue(term, 300);

  const accounts = useApi(
    () => api.listAccounts({ search: debounced || undefined, page_size: 25 }),
    [debounced],
  );

  function toggle(accountId: string) {
    setSelected((current) =>
      current.includes(accountId)
        ? current.filter((id) => id !== accountId)
        : [...current, accountId],
    );
  }

  async function handleAdd() {
    if (selected.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await api.addCampaignLeads(campaignId, selected);
      toast.success(`${result.added_leads} lead(s) added to the campaign.`);
      onAdded();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the selected accounts.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search accounts by number or customer…"
          className="pl-8"
          aria-label="Search accounts"
        />
      </div>

      <div className="max-h-72 overflow-y-auto rounded-lg border">
        {accounts.loading && !accounts.data ? (
          <p className="p-3 text-xs text-muted-foreground">Loading accounts…</p>
        ) : accounts.error ? (
          <div className="p-3">
            <ErrorState message={accounts.error} onRetry={accounts.refresh} compact />
          </div>
        ) : accounts.data && accounts.data.items.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">No accounts found.</p>
        ) : (
          accounts.data?.items.map((account) => (
            <label
              key={account.id}
              className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-accent"
            >
              <Checkbox
                checked={selected.includes(account.id)}
                onCheckedChange={() => toggle(account.id)}
                aria-label={`Select ${account.account_number}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-xs">{account.account_number}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {account.customer_name ?? "—"}
                </span>
              </span>
              <span className="shrink-0 text-sm tabular-nums">
                {formatMoney(account.outstanding_amount, account.currency)}
              </span>
            </label>
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground">{selected.length} selected</p>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        className="w-full"
        onClick={() => void handleAdd()}
        disabled={saving || selected.length === 0}
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        {saving ? "Adding…" : `Add ${selected.length || ""} lead(s)`}
      </Button>
    </div>
  );
}

export function AddLeadsDialog({
  campaignId,
  open,
  onOpenChange,
  onAdded,
}: {
  campaignId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add accounts to campaign</DialogTitle>
          <DialogDescription>
            Accounts already attached to this campaign are rejected by the server.
          </DialogDescription>
        </DialogHeader>
        <LeadPicker campaignId={campaignId} onOpenChange={onOpenChange} onAdded={onAdded} />
      </DialogContent>
    </Dialog>
  );
}

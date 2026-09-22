"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApi } from "@/hooks/use-api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { api, ApiError } from "@/lib/api";
import type { Creditor, Customer } from "@/lib/types";

const ACCOUNT_STATUSES = ["active", "paid", "disputed", "closed", "on_hold"];

function CustomerPicker({
  selected,
  onSelect,
}: {
  selected: Customer | null;
  onSelect: (customer: Customer | null) => void;
}) {
  const [term, setTerm] = useState("");
  const debounced = useDebouncedValue(term, 300);

  const results = useApi(
    () => api.listCustomers({ search: debounced || undefined, page_size: 8 }),
    [debounced],
  );

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-lg border p-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{selected.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {selected.phones[0]?.normalized_phone ?? selected.email ?? selected.id}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onSelect(null)}>
          Change
        </Button>
      </div>
    );
  }

  const items = results.data?.items ?? [];

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search customers by name or phone…"
          className="pl-8"
          aria-label="Search customers"
        />
      </div>
      <div className="max-h-44 overflow-y-auto rounded-lg border">
        {results.loading && items.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">Searching…</p>
        ) : items.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">
            {results.error ? results.error : "No customers found."}
          </p>
        ) : (
          items.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => onSelect(customer)}
              className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
            >
              <span className="truncate">{customer.name}</span>
              <span className="ml-2 shrink-0 font-mono text-xs text-muted-foreground">
                {customer.phones[0]?.normalized_phone ?? "—"}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function AccountForm({
  creditors,
  onOpenChange,
  onSaved,
}: {
  creditors: Creditor[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [creditorId, setCreditorId] = useState("none");
  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    if (!customer) {
      setError("Select the customer this account belongs to.");
      return;
    }
    if (!accountNumber.trim()) {
      setError("Account number is required.");
      return;
    }
    // The amount is sent to the backend as an exact decimal string.
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) {
      setError("Enter the outstanding amount as a number, for example 25000 or 25000.50.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const created = await api.createAccount({
        customer_id: customer.id,
        creditor_id: creditorId === "none" ? null : creditorId,
        account_number: accountNumber.trim(),
        outstanding_amount: amount.trim(),
        currency,
        due_date: dueDate || null,
        status,
      });
      toast.success(`Account ${created.account_number} created.`);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <form id="account-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Customer</Label>
          <CustomerPicker selected={customer} onSelect={setCustomer} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="account-number">Account number</Label>
          <Input
            id="account-number"
            required
            value={accountNumber}
            onChange={(event) => setAccountNumber(event.target.value)}
            placeholder="ACC-100234"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="account-amount">Outstanding amount</Label>
            <Input
              id="account-amount"
              required
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="25000.50"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-currency">Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="account-currency" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">INR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="account-creditor">Creditor</Label>
            <Select value={creditorId} onValueChange={setCreditorId}>
              <SelectTrigger id="account-creditor" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {creditors.map((creditor) => (
                  <SelectItem key={creditor.id} value={creditor.id}>
                    {creditor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-due-date">Due date</Label>
            <Input
              id="account-due-date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="account-status">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="account-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {value.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" form="account-form" disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          {saving ? "Creating…" : "Create account"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function AccountDialog({
  open,
  onOpenChange,
  onSaved,
  creditors,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  creditors: Creditor[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New account</DialogTitle>
          <DialogDescription>
            Account numbers must be unique within your organization.
          </DialogDescription>
        </DialogHeader>
        <AccountForm creditors={creditors} onOpenChange={onOpenChange} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

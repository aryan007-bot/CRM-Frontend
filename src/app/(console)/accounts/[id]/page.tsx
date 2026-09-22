"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { ErrorState, TableMessage } from "@/components/page-states";
import {
  AccountStatusBadge,
  PaymentStatusBadge,
} from "@/components/status-badges";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/api";
import { canWrite, useAuth } from "@/lib/auth";
import { formatDate, formatDateTime, formatMoney, sumMoney } from "@/lib/format";
import type { Account } from "@/lib/types";

const ACCOUNT_STATUSES = ["active", "paid", "disputed", "closed", "on_hold"];

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words">{value}</p>
    </div>
  );
}

function PaymentForm({
  accountId,
  currency,
  onRecorded,
}: {
  accountId: string;
  currency: string;
  onRecorded: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) {
      setError("Enter the payment amount as a number, for example 5000 or 5000.50.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await api.addPayment(accountId, {
        amount: amount.trim(),
        currency,
        // Send a full timestamp so the backend does not fall back to server-local time.
        payment_date: `${paymentDate}T00:00:00Z`,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
        status: "completed",
      });
      toast.success("Payment recorded.");
      setAmount("");
      setReference("");
      setNotes("");
      onRecorded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record the payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="payment-amount">Amount ({currency})</Label>
          <Input
            id="payment-amount"
            inputMode="decimal"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="5000.00"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payment-date">Payment date</Label>
          <Input
            id="payment-date"
            type="date"
            value={paymentDate}
            onChange={(event) => setPaymentDate(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="payment-reference">Reference</Label>
        <Input
          id="payment-reference"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="UPI / cheque / transaction id"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="payment-notes">Notes</Label>
        <Input
          id="payment-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Optional"
        />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={saving}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        {saving ? "Recording…" : "Record payment"}
      </Button>
    </form>
  );
}

function AccountEditForm({ account, onSaved }: { account: Account; onSaved: () => void }) {
  const [status, setStatus] = useState(account.status);
  const [dueDate, setDueDate] = useState(account.due_date ?? "");
  const [amount, setAmount] = useState(account.outstanding_amount);
  const [saving, setSaving] = useState(false);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) {
      toast.error("Outstanding amount must be a number such as 25000 or 25000.50.");
      return;
    }

    setSaving(true);
    try {
      await api.updateAccount(account.id, {
        status,
        due_date: dueDate || null,
        outstanding_amount: amount.trim(),
      });
      toast.success("Account updated.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update the account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSave}>
        <CardHeader>
          <CardTitle>Update account</CardTitle>
          <CardDescription>Only these fields are editable.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-outstanding">Outstanding amount</Label>
            <Input
              id="edit-outstanding"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-due-date">Due date</Label>
            <Input
              id="edit-due-date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="edit-status" className="w-full">
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
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const accountId = params?.id;
  const { user } = useAuth();
  const writable = canWrite(user);

  const account = useApi(accountId ? () => api.getAccount(accountId) : null, [accountId]);
  const data = account.data;

  if (account.loading && !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState message={account.error ?? "Account not found."} onRetry={account.refresh} />
        <div className="mt-4 text-center">
          <Button variant="outline" asChild>
            <Link href="/accounts">
              <ArrowLeft className="size-4" />
              Back to accounts
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Exact decimal addition — never float arithmetic on money.
  const totalPaid = sumMoney(
    data.payments
      .filter((payment) => payment.status === "completed")
      .map((payment) => payment.amount),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={`Account ${data.account_number}`}
        description={data.customer_name ?? "Customer unavailable"}
        actions={
          <Button variant="outline" asChild>
            <Link href="/accounts">
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Account details</CardTitle>
            <CardDescription>
              Amounts are exact decimal values stored by the backend.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Outstanding"
              value={
                <span className="tabular-nums">
                  {formatMoney(data.outstanding_amount, data.currency)}
                </span>
              }
            />
            <Field label="Status" value={<AccountStatusBadge status={data.status} />} />
            <Field
              label="Customer"
              value={
                <Link href={`/customers/${data.customer_id}`} className="hover:underline">
                  {data.customer_name ?? "—"}
                </Link>
              }
            />
            <Field label="Creditor" value={data.creditor_name ?? "Unassigned"} />
            <Field label="Due date" value={formatDate(data.due_date)} />
            <Field label="Currency" value={data.currency} />
            <Field label="Created" value={formatDateTime(data.created_at)} />
            <Field label="Last updated" value={formatDateTime(data.updated_at)} />
            <Field label="Payments recorded" value={String(data.payments.length)} />
            <Field
              label="Total paid on this page"
              value={<span className="tabular-nums">{formatMoney(totalPaid, data.currency)}</span>}
            />
          </CardContent>
        </Card>

        {writable ? (
          /* Keyed on the revision so the form re-seeds after a successful save. */
          <AccountEditForm
            key={`${data.id}-${data.updated_at}`}
            account={data}
            onSaved={account.refresh}
          />
        ) : null}
      </div>

      <Card className="mt-4 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Payment history</CardTitle>
          <CardDescription>Historical payments recorded against this account.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.payments.length === 0 ? (
                <TableMessage
                  columns={5}
                  icon={Plus}
                  title="No payments yet"
                  description="Recorded payments will appear here."
                />
              ) : (
                data.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-sm">
                      {formatDateTime(payment.payment_date)}
                    </TableCell>
                    <TableCell>
                      <PaymentStatusBadge status={payment.status} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {payment.reference ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {payment.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(payment.amount, payment.currency)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {writable ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Record a payment</CardTitle>
            <CardDescription>
              Recording a completed payment reduces the outstanding amount on the server.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentForm
              accountId={data.id}
              currency={data.currency}
              onRecorded={account.refresh}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

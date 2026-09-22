"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { AccountStatusBadge, CustomerStatusBadge } from "@/components/status-badges";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { CustomerDialog } from "../customer-dialog";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words">{value}</p>
    </div>
  );
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const customerId = params?.id;
  const router = useRouter();
  const { user } = useAuth();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const writable = canWrite(user);
  const canDelete = Boolean(
    user && (user.roles.includes("ORG_ADMIN") || user.roles.includes("SUPER_ADMIN")),
  );

  const customer = useApi(
    customerId ? () => api.getCustomer(customerId) : null,
    [customerId],
  );

  const accounts = useApi(
    customerId
      ? () => api.listAccounts({ customer_id: customerId, page_size: 100 })
      : null,
    [customerId],
  );

  async function handleDelete() {
    if (!customerId || deleting) return;
    setDeleting(true);
    try {
      await api.deleteCustomer(customerId);
      toast.success("Customer deleted.");
      router.push("/customers");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete the customer.");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  if (customer.loading && !customer.data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (customer.errorCode === "CUSTOMER_NOT_FOUND" || (!customer.loading && !customer.data)) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState
          message={customer.error ?? "Customer not found."}
          onRetry={customer.refresh}
        />
        <div className="mt-4 text-center">
          <Button variant="outline" asChild>
            <Link href="/customers">
              <ArrowLeft className="size-4" />
              Back to customers
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const data = customer.data;
  if (!data) return null;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={data.name}
        description={`Customer since ${formatDate(data.created_at.slice(0, 10))}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/customers">
                <ArrowLeft className="size-4" />
                Back
              </Link>
            </Button>
            {writable ? (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" />
                Edit
              </Button>
            ) : null}
            {canDelete ? (
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="size-4" />
                Delete
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Status" value={<CustomerStatusBadge status={data.status} />} />
            <Field label="Email" value={data.email ?? "—"} />
            <Field label="Created" value={formatDateTime(data.created_at)} />
            <Field label="Last updated" value={formatDateTime(data.updated_at)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Phone numbers</CardTitle>
            <CardDescription>Stored as entered, plus the normalized form.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.phones.length === 0 ? (
              <p className="text-sm text-muted-foreground">No phone numbers on record.</p>
            ) : (
              data.phones.map((phone) => (
                <div key={phone.id} className="space-y-1 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{phone.normalized_phone}</span>
                    {phone.is_primary ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Primary
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Entered as {phone.phone} · {phone.phone_type}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Accounts</CardTitle>
          <CardDescription>
            {accounts.data ? `${accounts.data.total} account(s) for this customer` : "Loading…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {accounts.error ? (
            <div className="p-4">
              <ErrorState message={accounts.error} onRetry={accounts.refresh} compact />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Creditor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Due date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.loading && !accounts.data ? (
                  <TableSkeleton rows={3} columns={5} />
                ) : accounts.data && accounts.data.items.length === 0 ? (
                  <TableMessage
                    columns={5}
                    icon={Wallet}
                    title="No accounts"
                    description="This customer has no accounts in the portfolio."
                  />
                ) : (
                  accounts.data?.items.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <Link
                          href={`/accounts/${account.id}`}
                          className="font-mono text-xs hover:underline"
                        >
                          {account.account_number}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {account.creditor_name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <AccountStatusBadge status={account.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(account.outstanding_amount, account.currency)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatDate(account.due_date)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CustomerDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        customer={data}
        onSaved={customer.refresh}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {data.name} and their accounts. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete customer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

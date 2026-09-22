"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Search, Wallet } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { Pagination } from "@/components/pagination";
import { AccountStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { api } from "@/lib/api";
import { canWrite, useAuth } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import { AccountDialog } from "./account-dialog";

const PAGE_SIZES = [10, 25, 50, 100];
const ACCOUNT_STATUSES = ["active", "paid", "disputed", "closed", "on_hold"];

function AccountsView() {
  const { user } = useAuth();
  const writable = canWrite(user);
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [creditorId, setCreditorId] = useState(searchParams.get("creditor_id") ?? "all");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [dialogOpen, setDialogOpen] = useState(false);

  const creditors = useApi(() => api.listCreditors({ page_size: 100 }), []);

  const accounts = useApi(
    () =>
      api.listAccounts({
        search: search || undefined,
        status: status === "all" ? undefined : status,
        creditor_id: creditorId === "all" ? undefined : creditorId,
        due_date_from: dueFrom || undefined,
        due_date_to: dueTo || undefined,
        page,
        page_size: pageSize,
      }),
    [search, status, creditorId, dueFrom, dueTo, page, pageSize],
  );

  const data = accounts.data;
  const hasFilters =
    Boolean(search) || status !== "all" || creditorId !== "all" || Boolean(dueFrom) || Boolean(dueTo);

  function clearFilters() {
    setSearch("");
    setSearchInput("");
    setStatus("all");
    setCreditorId("all");
    setDueFrom("");
    setDueTo("");
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Accounts"
        description="Every debt in the portfolio, with exact outstanding balances."
        actions={
          writable ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              New account
            </Button>
          ) : null
        }
      />

      <Card className="py-0">
        <CardContent className="px-0">
          <form
            className="flex flex-wrap items-end gap-2 border-b px-4 py-3"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(searchInput.trim());
              setPage(1);
            }}
          >
            <div className="relative min-w-56 flex-1 sm:max-w-xs">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Account number or customer…"
                className="pl-8"
                aria-label="Search accounts"
              />
            </div>

            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-36" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ACCOUNT_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={creditorId}
              onValueChange={(value) => {
                setCreditorId(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-44" aria-label="Filter by creditor">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All creditors</SelectItem>
                {(creditors.data?.items ?? []).map((creditor) => (
                  <SelectItem key={creditor.id} value={creditor.id}>
                    {creditor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-end gap-1">
              <div>
                <Label htmlFor="due-from" className="text-[11px] text-muted-foreground">
                  Due from
                </Label>
                <Input
                  id="due-from"
                  type="date"
                  className="w-36"
                  value={dueFrom}
                  onChange={(event) => {
                    setDueFrom(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div>
                <Label htmlFor="due-to" className="text-[11px] text-muted-foreground">
                  Due to
                </Label>
                <Input
                  id="due-to"
                  type="date"
                  className="w-36"
                  value={dueTo}
                  onChange={(event) => {
                    setDueTo(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>

            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-32" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button type="submit" variant="outline">
              Search
            </Button>
            {hasFilters ? (
              <Button type="button" variant="ghost" onClick={clearFilters}>
                Clear
              </Button>
            ) : null}
          </form>

          {accounts.error ? (
            <div className="p-4">
              <ErrorState message={accounts.error} onRetry={accounts.refresh} compact />
            </div>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Creditor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">Due date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.loading && !data ? (
                <TableSkeleton rows={6} columns={6} />
              ) : !accounts.error && data && data.items.length === 0 ? (
                <TableMessage
                  columns={6}
                  icon={Wallet}
                  title={hasFilters ? "No accounts match" : "No accounts yet"}
                  description={
                    hasFilters
                      ? "Adjust the filters or clear them to see the whole portfolio."
                      : "Import a portfolio or add an account manually."
                  }
                  action={
                    hasFilters ? (
                      <Button variant="outline" size="sm" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    ) : writable ? (
                      <Button size="sm" onClick={() => setDialogOpen(true)}>
                        <Plus className="size-4" />
                        New account
                      </Button>
                    ) : null
                  }
                />
              ) : (
                data?.items.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <Link
                        href={`/accounts/${account.id}`}
                        className="font-mono text-xs hover:underline"
                      >
                        {account.account_number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      <Link
                        href={`/customers/${account.customer_id}`}
                        className="hover:underline"
                      >
                        {account.customer_name ?? "—"}
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

          <Pagination
            page={data?.page ?? page}
            pageSize={data?.page_size ?? pageSize}
            total={data?.total ?? 0}
            onPageChange={setPage}
            disabled={accounts.loading}
          />
        </CardContent>
      </Card>

      <AccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        creditors={creditors.data?.items ?? []}
        onSaved={() => {
          setPage(1);
          accounts.refresh();
        }}
      />
    </div>
  );
}

export default function AccountsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl space-y-4">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <AccountsView />
    </Suspense>
  );
}

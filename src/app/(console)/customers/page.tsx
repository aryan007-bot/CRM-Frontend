"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { Pagination } from "@/components/pagination";
import { CustomerStatusBadge } from "@/components/status-badges";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { canWrite, useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { formatRelative, initials } from "@/lib/format";
import { CustomerDialog } from "./customer-dialog";

const PAGE_SIZES = [10, 25, 50, 100];

export default function CustomersPage() {
  const { user } = useAuth();
  const writable = canWrite(user);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [dialogOpen, setDialogOpen] = useState(false);

  const customers = useApi(
    () =>
      api.listCustomers({
        search: search || undefined,
        status: status === "all" ? undefined : status,
        page,
        page_size: pageSize,
      }),
    [search, status, page, pageSize],
  );

  const data = customers.data;

  function applySearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Customers"
        description="Debtors in your organization's portfolio."
        actions={
          writable ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              New customer
            </Button>
          ) : null
        }
      />

      <Card className="py-0">
        <CardContent className="px-0">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <form className="relative min-w-56 flex-1 sm:max-w-xs" onSubmit={applySearch}>
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Name, email or phone…"
                className="pl-8"
                aria-label="Search customers"
              />
            </form>

            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

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

            {customers.error ? (
              <div className="ml-auto">
                <ErrorState message={customers.error} onRetry={customers.refresh} compact />
              </div>
            ) : (
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {data ? `${data.total} customers` : "Loading…"}
              </span>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.loading && !data ? (
                <TableSkeleton rows={5} columns={4} />
              ) : customers.error && !data ? (
                <TableMessage
                  columns={4}
                  icon={Users}
                  title="Could not load customers"
                  description={customers.error}
                  action={
                    <Button variant="outline" size="sm" onClick={customers.refresh}>
                      Try again
                    </Button>
                  }
                />
              ) : data && data.items.length === 0 ? (
                <TableMessage
                  columns={4}
                  icon={Users}
                  title={search || status !== "all" ? "No customers match" : "No customers yet"}
                  description={
                    search || status !== "all"
                      ? "Try a different search term or clear the filters."
                      : "Import a portfolio or add a customer to get started."
                  }
                  action={
                    search || status !== "all" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSearch("");
                          setSearchInput("");
                          setStatus("all");
                          setPage(1);
                        }}
                      >
                        Clear filters
                      </Button>
                    ) : writable ? (
                      <Button size="sm" onClick={() => setDialogOpen(true)}>
                        <Plus className="size-4" />
                        New customer
                      </Button>
                    ) : null
                  }
                />
              ) : (
                data?.items.map((customer) => {
                  const primary =
                    customer.phones.find((phone) => phone.is_primary) ?? customer.phones[0];
                  return (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <Link
                          href={`/customers/${customer.id}`}
                          className="flex items-center gap-3"
                        >
                          <Avatar className="size-8">
                            <AvatarFallback className="text-xs">
                              {initials(customer.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium hover:underline">{customer.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {customer.email ?? "No email"}
                            </p>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {primary ? primary.normalized_phone : "—"}
                      </TableCell>
                      <TableCell>
                        <CustomerStatusBadge status={customer.status} />
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatRelative(customer.updated_at)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          <Pagination
            page={data?.page ?? page}
            pageSize={data?.page_size ?? pageSize}
            total={data?.total ?? 0}
            onPageChange={setPage}
            disabled={customers.loading}
          />
        </CardContent>
      </Card>

      <CustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => {
          setPage(1);
          customers.refresh();
        }}
      />
    </div>
  );
}

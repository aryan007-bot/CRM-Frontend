"use client";

import Link from "next/link";
import {
  ClipboardList,
  FileSpreadsheet,
  Landmark,
  Megaphone,
  Users,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState } from "@/components/page-states";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { formatCount, formatMoney } from "@/lib/format";

function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
  href,
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}) {
  return (
    <Card className="py-5">
      <CardHeader className="px-5">
        <CardDescription className="flex items-center justify-between">
          {title}
          <Icon className="size-4 text-muted-foreground" />
        </CardDescription>
        <CardTitle className="mt-1.5 text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="px-5">
        <Link href={href} className="text-xs text-muted-foreground underline-offset-4 hover:underline">
          {hint}
        </Link>
      </CardContent>
    </Card>
  );
}

function KpiSkeleton() {
  return (
    <div className="space-y-2 rounded-xl border bg-card p-5">
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="h-7 w-20" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const summary = useApi(() => api.getDashboardSummary(), []);

  const data = summary.data;
  const hasAnyData =
    data !== null &&
    (data.customers > 0 ||
      data.accounts > 0 ||
      data.active_campaigns > 0 ||
      data.pending_imports > 0);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={`Welcome${user ? `, ${user.name.split(" ")[0]}` : ""}`}
        description="Live portfolio totals for your organization. Every figure is read from the database."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/imports">Import portfolio</Link>
            </Button>
            <Button asChild>
              <Link href="/campaigns">New campaign</Link>
            </Button>
          </>
        }
      />

      {summary.error ? (
        <ErrorState message={summary.error} onRetry={summary.refresh} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {data ? (
              <>
                <KpiCard
                  title="Customers"
                  value={formatCount(data.customers)}
                  hint="View customers"
                  icon={Users}
                  href="/customers"
                />
                <KpiCard
                  title="Accounts"
                  value={formatCount(data.accounts)}
                  hint="View accounts"
                  icon={Wallet}
                  href="/accounts"
                />
                <KpiCard
                  title="Total outstanding"
                  value={formatMoney(data.total_outstanding)}
                  hint="View accounts"
                  icon={Landmark}
                  href="/accounts"
                />
                <KpiCard
                  title="Active campaigns"
                  value={formatCount(data.active_campaigns)}
                  hint="View campaigns"
                  icon={Megaphone}
                  href="/campaigns"
                />
                <KpiCard
                  title="Pending imports"
                  value={formatCount(data.pending_imports)}
                  hint="View imports"
                  icon={FileSpreadsheet}
                  href="/imports"
                />
              </>
            ) : (
              Array.from({ length: 5 }).map((_, index) => <KpiSkeleton key={index} />)
            )}
          </div>

          {data && !hasAnyData ? (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Nothing here yet</CardTitle>
                <CardDescription>
                  This workspace is empty. Import a portfolio of accounts to get started — the
                  figures above update as soon as real data exists.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href="/imports">
                    <FileSpreadsheet className="size-4" />
                    Import a spreadsheet
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/customers">Add a customer manually</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {data && hasAnyData ? (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Phase 1 modules</CardTitle>
                <CardDescription>
                  Calling, AI agents and live transcripts arrive in Phase 2.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { href: "/customers", label: "Customers", icon: Users },
                  { href: "/accounts", label: "Accounts", icon: Wallet },
                  { href: "/imports", label: "Imports", icon: ClipboardList },
                  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-accent"
                  >
                    <item.icon className="size-4 text-muted-foreground" />
                    {item.label}
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

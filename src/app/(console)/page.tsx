"use client";

import {
  Activity,
  Bot,
  CalendarCheck,
  PhoneCall,
  PhoneOutgoing,
  Target,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/app-shell";
import { CallTable } from "@/components/call-table";
import { OutcomeBadge } from "@/components/status-badges";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { formatCurrency, percent } from "@/lib/format";

const OUTCOME_COLORS: Record<string, string> = {
  ai_resolved: "var(--color-emerald-500)",
  promise_to_pay: "var(--color-teal-500)",
  human_takeover: "var(--color-amber-500)",
  callback_scheduled: "var(--color-violet-500)",
  no_answer: "var(--color-zinc-400)",
  voicemail: "var(--color-zinc-400)",
  busy: "var(--color-zinc-400)",
  failed: "var(--color-red-500)",
};

function KpiCard({
  title,
  value,
  icon: Icon,
  sub,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  sub: string;
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
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function KpiSkeleton() {
  return (
    <div className="space-y-2 rounded-xl border bg-card p-5">
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}

export default function DashboardPage() {
  const stats = useApi(() => api.getDashboard(), []);

  if (stats.error) {
    return (
      <div className="py-24 text-center text-sm text-destructive">{stats.error}</div>
    );
  }

  const data = stats.data;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Dashboard"
        description="Live view of dialer throughput, AI resolution, and recovery outcomes."
      />

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {data ? (
          <>
            <KpiCard
              title="Active campaigns"
              value={String(data.kpis.activeCampaigns)}
              icon={Target}
              sub="of 6 total campaigns"
            />
            <KpiCard
              title="Calls today"
              value={String(data.kpis.callsToday)}
              icon={PhoneOutgoing}
              sub="since midnight local"
            />
            <KpiCard
              title="Connect rate"
              value={percent(data.kpis.connectRate)}
              icon={PhoneCall}
              sub="connected ÷ dialed, 14d"
            />
            <KpiCard
              title="AI resolution"
              value={percent(data.kpis.aiResolutionRate)}
              icon={Bot}
              sub="resolved without a human"
            />
            <KpiCard
              title="Promises today"
              value={String(data.kpis.promisedToday)}
              icon={CalendarCheck}
              sub="commitments to pay"
            />
            <KpiCard
              title="Promised amount"
              value={formatCurrency(data.kpis.promisedAmount)}
              icon={Activity}
              sub="committed today"
            />
          </>
        ) : (
          Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)
        )}
      </div>

      {/* Charts row */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Call volume — today</CardTitle>
            <CardDescription>Hourly dialed vs connected, 8am–8pm ET</CardDescription>
          </CardHeader>
          <CardContent>
            {data ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.hourly} margin={{ left: -20, right: 8 }}>
                    <defs>
                      <linearGradient id="fillCalls" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="hour" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} width={48} />
                    <ChartTooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                            <p className="font-medium">{label}:00</p>
                            {payload.map((p) => (
                              <p key={String(p.name)} className="text-muted-foreground">
                                {p.name === "calls" ? "Dialed" : "Connected"}: {p.value}
                              </p>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="calls"
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      fill="url(#fillCalls)"
                    />
                    <Area
                      type="monotone"
                      dataKey="connected"
                      stroke="var(--chart-3)"
                      strokeWidth={2}
                      fill="transparent"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Skeleton className="h-64 w-full" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Outcome mix</CardTitle>
            <CardDescription>Last 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            {data ? (
              <>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.outcomes}
                        dataKey="count"
                        nameKey="outcome"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {data.outcomes.map((o) => (
                          <Cell key={o.outcome} fill={OUTCOME_COLORS[o.outcome] ?? "var(--chart-2)"} />
                        ))}
                      </Pie>
                      <ChartTooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const p = payload[0];
                          const outcome = String(p.payload?.outcome ?? "");
                          return (
                            <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                              <p className="font-medium capitalize">
                                {outcome.replace(/_/g, " ")}
                              </p>
                              <p className="text-muted-foreground">{p.value} calls</p>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-1.5">
                  {data.outcomes.slice(0, 5).map((o) => (
                    <div key={o.outcome} className="flex items-center gap-2 text-xs">
                      <span
                        className="size-2 rounded-full"
                        style={{ background: OUTCOME_COLORS[o.outcome] ?? "var(--chart-2)" }}
                      />
                      <OutcomeBadge outcome={o.outcome} />
                      <span className="ml-auto tabular-nums text-muted-foreground">{o.count}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <Skeleton className="h-64 w-full" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* 14-day trend + recent calls */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Daily volume — 14 days</CardTitle>
            <CardDescription>Dialed vs connected calls per day</CardDescription>
          </CardHeader>
          <CardContent>
            {data ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.daily} margin={{ left: -20, right: 8 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} width={48} />
                    <ChartTooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                            <p className="font-medium">{label}</p>
                            {payload.map((p) => (
                              <p key={String(p.name)} className="text-muted-foreground">
                                {p.name === "calls" ? "Dialed" : "Connected"}: {p.value}
                              </p>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="calls" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="connected" fill="var(--chart-3)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Skeleton className="h-56 w-full" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Recent calls</CardTitle>
            <CardDescription>Newest first — click the eye to open the transcript</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            {data ? (
              <CallTable calls={data.recentCalls} />
            ) : (
              <div className="space-y-2 px-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

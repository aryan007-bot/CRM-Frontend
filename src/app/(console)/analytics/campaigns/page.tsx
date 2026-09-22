"use client";

/**
 * Campaign Analytics index (spec §23) — campaign-level comparison with links
 * into each campaign's detailed analytics tab.
 */

import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { Card, CardContent } from "@/components/ui/card";
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
import { Phase3CampaignStatusBadge } from "@/components/recovery-badges";
import { formatRelative } from "@/lib/format";

export default function CampaignAnalyticsIndexPage() {
  const campaigns = useApi(() => api.listCampaignsV3({ page_size: 50 }), []);

  const data = campaigns.data ?? null;

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Campaign Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Outcome counters per campaign. Open a campaign for connection rates, trends and
          outcome distributions.
        </p>
      </header>

      <Card className="py-0">
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Attempted</TableHead>
                  <TableHead className="text-right">Connected</TableHead>
                  <TableHead className="text-right">Promised</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Disputed</TableHead>
                  <TableHead className="text-right">Escalated</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.loading && !data ? (
                  <TableSkeleton rows={6} columns={10} />
                ) : campaigns.error ? (
                  <TableRow>
                    <TableCell colSpan={10}>
                      <div className="p-4">
                        <ErrorState message={campaigns.error} onRetry={campaigns.refresh} />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : data && data.items.length === 0 ? (
                  <TableMessage
                    columns={10}
                    icon={BarChart3}
                    title="No campaigns yet"
                    description="Create a campaign to start collecting recovery analytics."
                  />
                ) : (
                  data?.items.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <Link href={`/campaigns/${campaign.id}/analytics`} className="text-sm font-medium hover:underline">
                          {campaign.name}
                        </Link>
                      </TableCell>
                      <TableCell><Phase3CampaignStatusBadge value={campaign.status} /></TableCell>
                      <TableCell className="text-right tabular-nums">{campaign.total_leads}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {campaign.attempted_leads ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {campaign.connected_leads ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {campaign.promised_leads ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {campaign.paid_leads ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {campaign.disputed_leads ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {campaign.escalated_leads ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatRelative(campaign.updated_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

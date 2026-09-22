"use client";

/**
 * Campaign Activity tab (spec §33) — audit timeline of every automated and
 * operator action on this campaign.
 */

import { useState } from "react";
import { useParams } from "next/navigation";
import { Activity } from "lucide-react";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { Pagination } from "@/components/pagination";
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
import { formatDateTime } from "@/lib/format";

export default function CampaignActivityPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params?.id;
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const activity = useApi(
    campaignId ? () => api.getCampaignActivity(campaignId, page, pageSize) : null,
    [campaignId, page],
  );

  const data = activity.data ?? null;

  return (
    <Card className="py-0">
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Actor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activity.loading && !data ? (
                <TableSkeleton rows={8} columns={4} />
              ) : activity.error ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <div className="p-4">
                      <ErrorState message={activity.error} onRetry={activity.refresh} />
                    </div>
                  </TableCell>
                </TableRow>
              ) : data && data.items.length === 0 ? (
                <TableMessage
                  columns={4}
                  icon={Activity}
                  title="No activity recorded"
                  description="Campaign events will appear here as leads are processed."
                />
              ) : (
                data?.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(item.created_at)}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{item.action}</TableCell>
                    <TableCell className="max-w-96 text-xs text-muted-foreground">
                      {item.detail ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">{item.actor ?? "system"}</TableCell>
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
          disabled={activity.loading}
        />
      </CardContent>
    </Card>
  );
}

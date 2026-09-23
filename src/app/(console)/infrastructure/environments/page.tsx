"use client";

/**
 * Environment Health (spec §31).
 *
 * One row per environment the backend reports, with per-component states and
 * overall health. Clicking an environment opens its detail view.
 */

import Link from "next/link";
import { CloudCog } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState } from "@/components/page-states";
import { HealthGrid, UpdatedAt } from "@/components/phase4/phase4-parts";
import { SystemStateBadge } from "@/components/phase4/phase4-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { useLiveCallSocket } from "@/hooks/use-live-call-socket";
import { infraApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { formatRelative } from "@/lib/format";

export default function EnvironmentsPage() {
  const environments = useApi(() => infraApi.environments(), []);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).includes("phase4:environments")) environments.refresh();
  };
  useLiveCallSocket({ onEvent });

  const data = environments.data;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="Environments"
        description="Health of each deployed environment. Only environments reported by the backend are listed."
        actions={<UpdatedAt at={data?.[0]?.updated_at} />}
      />

      {environments.error ? (
        <ErrorState message={environments.error} onRetry={environments.refresh} />
      ) : !data ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No environments reported by the backend.
        </p>
      ) : (
        data.map((env) => (
          <Card key={env.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Link
                    href={`/deployments?environment=${encodeURIComponent(env.name)}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {env.name}
                  </Link>
                  <SystemStateBadge value={env.state} />
                </CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Version <span className="font-mono">{env.version ?? "—"}</span>
                  {env.updated_at ? ` · updated ${formatRelative(env.updated_at)}` : ""}
                </p>
              </div>
              <CloudCog className="size-4 text-muted-foreground" aria-hidden />
            </CardHeader>
            <CardContent>
              <HealthGrid components={env.components} />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

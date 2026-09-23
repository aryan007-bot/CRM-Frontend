"use client";

/**
 * Phase 4 status badges — every control-plane state renders through these so
 * the same state always looks and reads identically. Icons/dots double as the
 * non-color signal required for accessibility.
 */

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { MetaTone } from "@/lib/recovery";
import type { InfraStatusMeta } from "@/lib/phase4-meta";
import {
  alertStateMeta,
  credentialStateMeta,
  deploymentStatusMeta,
  eventSeverityMeta,
  gatewayStateMeta,
  healthMeta,
  incidentSeverityMeta,
  incidentStatusMeta,
  jobStatusMeta,
  providerStatusMeta,
  queueStateMeta,
  routingRoleMeta,
  securitySeverityMeta,
  systemStateMeta,
  workerStatusMeta,
} from "@/lib/phase4-meta";

const TONES: Record<MetaTone, string> = {
  neutral: "bg-secondary text-secondary-foreground",
  success: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400",
  info: "bg-blue-600/15 text-blue-700 dark:text-blue-400",
  progress: "bg-sky-600/15 text-sky-700 dark:text-sky-400",
  warning: "bg-amber-600/15 text-amber-700 dark:text-amber-400",
  danger: "bg-red-600/15 text-red-700 dark:text-red-400",
  muted: "bg-secondary text-muted-foreground",
};

function MetaBadge({
  meta,
  className,
  pulse = false,
}: {
  meta: InfraStatusMeta;
  className?: string;
  pulse?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn("gap-1.5 border-transparent font-medium", TONES[meta.tone], className)}
        >
          <span
            className={cn("size-1.5 rounded-full bg-current", pulse && "animate-pulse")}
            aria-hidden
          />
          {meta.label}
          <span className="sr-only">{meta.hint}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{meta.hint}</TooltipContent>
    </Tooltip>
  );
}

function metaFor(map: Record<string, InfraStatusMeta>, value: string | null | undefined): InfraStatusMeta {
  const key = (value ?? "").toUpperCase();
  if (value && map[key]) return map[key];
  return {
    label: value ? value.replace(/[_-]+/g, " ") : "—",
    tone: "neutral",
    hint: value ? "Unrecognised state value." : "No value reported.",
  };
}

export function SystemStateBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  return (
    <MetaBadge
      meta={systemStateMeta(value)}
      className={className}
      pulse={value?.toUpperCase() !== "OPERATIONAL"}
    />
  );
}

export function HealthBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  return <MetaBadge meta={healthMeta(value)} className={className} />;
}

export function WorkerStatusBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  return <MetaBadge meta={workerStatusMeta(value)} className={className} />;
}

export function QueueStateBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  return <MetaBadge meta={queueStateMeta(value)} className={className} />;
}

export function JobStatusBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  return <MetaBadge meta={jobStatusMeta(value)} className={className} />;
}

export function GatewayStateBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  return <MetaBadge meta={gatewayStateMeta(value)} className={className} />;
}

export function ProviderStatusBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  return <MetaBadge meta={providerStatusMeta(value)} className={className} />;
}

export function CredentialStateBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  return <MetaBadge meta={credentialStateMeta(value)} className={className} />;
}

export function RoutingRoleBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  return <MetaBadge meta={routingRoleMeta(value)} className={className} />;
}

export function IncidentStatusBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  return <MetaBadge meta={incidentStatusMeta(value)} className={className} />;
}

export function IncidentSeverityBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  return <MetaBadge meta={incidentSeverityMeta(value)} className={className} />;
}

export function AlertStateBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  return <MetaBadge meta={alertStateMeta(value)} className={className} />;
}

export function DeploymentStatusBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  return <MetaBadge meta={deploymentStatusMeta(value)} className={className} />;
}

export function EventSeverityBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  return <MetaBadge meta={eventSeverityMeta(value)} className={className} />;
}

export function SecuritySeverityBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  return <MetaBadge meta={securitySeverityMeta(value)} className={className} />;
}

/** Scope chip distinguishing platform-global from organization-scoped rows. */
export function ScopeBadge({ scope, className }: { scope: string | null | undefined; className?: string }) {
  const isPlatform = (scope ?? "").toUpperCase() === "PLATFORM";
  return (
    <Badge variant="outline" className={cn("text-[10px]", className)}>
      {isPlatform ? "Platform" : "Organization"}
    </Badge>
  );
}

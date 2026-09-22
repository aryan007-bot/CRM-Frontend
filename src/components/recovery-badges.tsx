"use client";

/**
 * Phase 3 status badges.
 *
 * Every badge derives its label/tone/icon from `lib/recovery.ts` so the same
 * status always looks and reads identically across screens. Icons double as
 * the non-color signal required for accessibility (spec §37).
 */

import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  campaignStatusMeta,
  callbackMeta,
  disputeMeta,
  escalationMeta,
  exportStatusMeta,
  followUpMeta,
  leadStatusMeta,
  outcomeMeta,
  paymentIntentMeta,
  priorityMeta,
  ptpMeta,
  queueMeta,
  type MetaTone,
  type StatusMeta,
} from "@/lib/recovery";

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
  value,
  className,
}: {
  meta: StatusMeta;
  value?: string | null;
  className?: string;
}) {
  const Icon = meta.icon as LucideIcon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn("gap-1.5 border-transparent font-medium", TONES[meta.tone], className)}
        >
          <Icon className="size-3 shrink-0" aria-hidden />
          {meta.label}
          <span className="sr-only">{meta.hint}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        {meta.hint}
        {value ? <span className="block text-[10px] opacity-70">{value}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}

export function OutcomeBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  return <MetaBadge meta={outcomeMeta(value)} value={value ?? undefined} className={className} />;
}

export function PaymentIntentBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  return <MetaBadge meta={paymentIntentMeta(value)} value={value ?? undefined} className={className} />;
}

export function PtpStatusBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  return <MetaBadge meta={ptpMeta(value)} value={value ?? undefined} className={className} />;
}

export function CallbackStatusBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  return <MetaBadge meta={callbackMeta(value)} value={value ?? undefined} className={className} />;
}

export function DisputeStatusBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  return <MetaBadge meta={disputeMeta(value)} value={value ?? undefined} className={className} />;
}

export function EscalationStatusBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  return <MetaBadge meta={escalationMeta(value)} value={value ?? undefined} className={className} />;
}

export function FollowUpStatusBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  return <MetaBadge meta={followUpMeta(value)} value={value ?? undefined} className={className} />;
}

export function QueueStatusBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  return <MetaBadge meta={queueMeta(value)} value={value ?? undefined} className={className} />;
}

export function ExportStatusBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  return <MetaBadge meta={exportStatusMeta(value)} value={value ?? undefined} className={className} />;
}

export function Phase3CampaignStatusBadge({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  return <MetaBadge meta={campaignStatusMeta(value)} value={value ?? undefined} className={className} />;
}

export function Phase3LeadStatusBadge({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  return <MetaBadge meta={leadStatusMeta(value)} value={value ?? undefined} className={className} />;
}

export function PriorityBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  return <MetaBadge meta={priorityMeta(value)} value={value ?? undefined} className={className} />;
}

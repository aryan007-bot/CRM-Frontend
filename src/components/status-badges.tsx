import { Badge } from "@/components/ui/badge";
import { humanize } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Badge tones, expressed as class strings so the mapping stays declarative. */
const TONES = {
  neutral: "bg-secondary text-secondary-foreground",
  success: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400",
  info: "bg-blue-600/15 text-blue-700 dark:text-blue-400",
  progress: "bg-sky-600/15 text-sky-700 dark:text-sky-400",
  warning: "bg-amber-600/15 text-amber-700 dark:text-amber-400",
  danger: "bg-red-600/15 text-red-700 dark:text-red-400",
  muted: "bg-secondary text-muted-foreground",
} as const;

type Tone = keyof typeof TONES;

function toneFor(map: Record<string, Tone>, value: string | null | undefined): Tone {
  if (!value) return "muted";
  return map[value.toLowerCase()] ?? "neutral";
}

function Dot() {
  return <span className="size-1.5 rounded-full bg-current" />;
}

export function StatusBadge({
  value,
  toneMap,
  className,
}: {
  value: string | null | undefined;
  toneMap: Record<string, Tone>;
  className?: string;
}) {
  const tone = toneFor(toneMap, value);
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 border-transparent", TONES[tone], className)}
    >
      <Dot />
      {humanize(value)}
    </Badge>
  );
}

const CUSTOMER_TONES: Record<string, Tone> = {
  active: "success",
  inactive: "muted",
};

export function CustomerStatusBadge({ status }: { status: string }) {
  return <StatusBadge value={status} toneMap={CUSTOMER_TONES} />;
}

const ACCOUNT_TONES: Record<string, Tone> = {
  active: "success",
  paid: "info",
  disputed: "danger",
  closed: "muted",
  on_hold: "warning",
};

export function AccountStatusBadge({ status }: { status: string }) {
  return <StatusBadge value={status} toneMap={ACCOUNT_TONES} />;
}

const CAMPAIGN_TONES: Record<string, Tone> = {
  draft: "neutral",
  ready: "info",
  running: "success",
  paused: "warning",
  completed: "info",
  archived: "muted",
};

export function CampaignStatusBadge({ status }: { status: string }) {
  return <StatusBadge value={status} toneMap={CAMPAIGN_TONES} />;
}

const LEAD_TONES: Record<string, Tone> = {
  pending: "neutral",
  queued: "info",
  processing: "progress",
  completed: "success",
  retry: "warning",
  skipped: "muted",
  failed: "danger",
};

export function LeadStatusBadge({ status }: { status: string }) {
  return <StatusBadge value={status} toneMap={LEAD_TONES} />;
}

const IMPORT_TONES: Record<string, Tone> = {
  uploaded: "neutral",
  processing: "progress",
  completed: "success",
  partially_completed: "warning",
  failed: "danger",
};

export function ImportStatusBadge({ status }: { status: string }) {
  return <StatusBadge value={status} toneMap={IMPORT_TONES} />;
}

const PAYMENT_TONES: Record<string, Tone> = {
  completed: "success",
  pending: "warning",
  failed: "danger",
};

export function PaymentStatusBadge({ status }: { status: string }) {
  return <StatusBadge value={status} toneMap={PAYMENT_TONES} />;
}

export function RoleBadge({ role }: { role: string }) {
  const tone: Tone = role === "SUPER_ADMIN" || role === "ORG_ADMIN" ? "info" : "neutral";
  return (
    <Badge variant="outline" className={cn("border-transparent", TONES[tone])}>
      {role.replace(/_/g, " ")}
    </Badge>
  );
}

// ==========================================
// Phase 2 Badges
// ==========================================

const CALL_TONES: Record<string, Tone> = {
  connecting: "progress",
  ringing: "warning",
  connected: "success",
  ai_talking: "info",
  customer_talking: "success",
  on_hold: "warning",
  transferring: "progress",
  human_connected: "info",
  ending: "muted",
  failed: "danger",
};

export function CallStatusBadge({ status, className }: { status: string; className?: string }) {
  return <StatusBadge value={status} toneMap={CALL_TONES} className={className} />;
}

const AI_STATE_TONES: Record<string, Tone> = {
  idle: "muted",
  listening: "progress",
  thinking: "warning",
  speaking: "info",
  interrupted: "danger",
  transfer_pending: "progress",
  failed: "danger",
};

export function AIStateBadge({ state, className }: { state: string; className?: string }) {
  return <StatusBadge value={state} toneMap={AI_STATE_TONES} className={className} />;
}

const GATEWAY_TONES: Record<string, Tone> = {
  online: "success",
  offline: "muted",
  busy: "warning",
  error: "danger",
  unknown: "neutral",
};

export function GatewayStatusBadge({ status }: { status: string }) {
  return <StatusBadge value={status} toneMap={GATEWAY_TONES} />;
}

const AGENT_TONES: Record<string, Tone> = {
  draft: "neutral",
  ready: "info",
  active: "success",
  disabled: "muted",
  error: "danger",
};

export function AIAgentStatusBadge({ status }: { status: string }) {
  return <StatusBadge value={status} toneMap={AGENT_TONES} />;
}

const HEALTH_TONES: Record<string, Tone> = {
  healthy: "success",
  degraded: "warning",
  offline: "danger",
  rate_limited: "warning",
  error: "danger",
  connected: "success",
  down: "danger",
};

export function ServiceHealthBadge({ status }: { status: string }) {
  return <StatusBadge value={status} toneMap={HEALTH_TONES} />;
}

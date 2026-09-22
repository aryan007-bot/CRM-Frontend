import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  CallOutcome,
  CampaignStatus,
  ContactStatus,
  LiveCallState,
  Sentiment,
} from "@/lib/types";

function BadgeDot({ className }: { className?: string }) {
  return <span className={cn("size-1.5 rounded-full bg-current", className)} />;
}

const CAMPAIGN_STYLES: Record<CampaignStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-secondary text-secondary-foreground" },
  active: { label: "Active", className: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400" },
  paused: { label: "Paused", className: "bg-amber-600/15 text-amber-700 dark:text-amber-400" },
  completed: { label: "Completed", className: "bg-blue-600/15 text-blue-700 dark:text-blue-400" },
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const s = CAMPAIGN_STYLES[status];
  return (
    <Badge variant="outline" className={cn("gap-1.5 border-transparent", s.className)}>
      <BadgeDot />
      {s.label}
    </Badge>
  );
}

const CONTACT_STYLES: Record<ContactStatus, { label: string; className: string }> = {
  new: { label: "New", className: "bg-blue-600/15 text-blue-700 dark:text-blue-400" },
  in_progress: { label: "In progress", className: "bg-secondary text-secondary-foreground" },
  promised_to_pay: {
    label: "Promised to pay",
    className: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400",
  },
  payment_arranged: {
    label: "Payment arranged",
    className: "bg-teal-600/15 text-teal-700 dark:text-teal-400",
  },
  callback: { label: "Callback", className: "bg-violet-600/15 text-violet-700 dark:text-violet-400" },
  disputed: { label: "Disputed", className: "bg-red-600/15 text-red-700 dark:text-red-400" },
  do_not_call: { label: "Do not call", className: "bg-zinc-600/15 text-zinc-700 dark:text-zinc-400" },
  closed: { label: "Closed", className: "bg-secondary text-muted-foreground" },
};

export function ContactStatusBadge({ status }: { status: ContactStatus }) {
  const s = CONTACT_STYLES[status];
  return (
    <Badge variant="outline" className={cn("gap-1.5 border-transparent", s.className)}>
      <BadgeDot />
      {s.label}
    </Badge>
  );
}

const OUTCOME_STYLES: Record<CallOutcome, { label: string; className: string }> = {
  ai_resolved: {
    label: "AI resolved",
    className: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400",
  },
  promise_to_pay: {
    label: "Promise to pay",
    className: "bg-teal-600/15 text-teal-700 dark:text-teal-400",
  },
  human_takeover: {
    label: "Human takeover",
    className: "bg-amber-600/15 text-amber-700 dark:text-amber-400",
  },
  callback_scheduled: {
    label: "Callback",
    className: "bg-violet-600/15 text-violet-700 dark:text-violet-400",
  },
  no_answer: { label: "No answer", className: "bg-secondary text-muted-foreground" },
  voicemail: { label: "Voicemail", className: "bg-secondary text-muted-foreground" },
  busy: { label: "Busy", className: "bg-secondary text-muted-foreground" },
  failed: { label: "Failed", className: "bg-red-600/15 text-red-700 dark:text-red-400" },
};

export function OutcomeBadge({ outcome }: { outcome: CallOutcome }) {
  const s = OUTCOME_STYLES[outcome];
  return (
    <Badge variant="outline" className={cn("gap-1.5 border-transparent", s.className)}>
      <BadgeDot />
      {s.label}
    </Badge>
  );
}

const SENTIMENT_STYLES: Record<Sentiment, { className: string; label: string }> = {
  positive: { className: "text-emerald-600 dark:text-emerald-400", label: "Positive" },
  neutral: { className: "text-muted-foreground", label: "Neutral" },
  negative: { className: "text-red-600 dark:text-red-400", label: "Negative" },
};

export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const s = SENTIMENT_STYLES[sentiment];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", s.className)}>
      <BadgeDot />
      {s.label}
    </span>
  );
}

const LIVE_STATE_STYLES: Record<LiveCallState, { label: string; className: string }> = {
  dialing: { label: "Dialing", className: "bg-blue-600/15 text-blue-700 dark:text-blue-400" },
  talking: {
    label: "Talking",
    className: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400",
  },
  hold: { label: "Hold", className: "bg-amber-600/15 text-amber-700 dark:text-amber-400" },
  transferring: {
    label: "Transferring",
    className: "bg-violet-600/15 text-violet-700 dark:text-violet-400",
  },
  wrap_up: { label: "Wrap-up", className: "bg-secondary text-secondary-foreground" },
};

export function LiveStateBadge({ state }: { state: LiveCallState }) {
  const s = LIVE_STATE_STYLES[state];
  return (
    <Badge variant="outline" className={cn("gap-1.5 border-transparent", s.className)}>
      <BadgeDot />
      {s.label}
    </Badge>
  );
}

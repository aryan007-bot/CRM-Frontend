/**
 * Phase 3 recovery-domain metadata.
 *
 * Single source of truth for outcome/status labels, tones and icons so every
 * screen renders identical semantics for the same status string. Badge
 * components read from here; pages never hand-roll per-page tone maps for
 * shared statuses.
 *
 * The backend may send values in either case; lookups normalise to upper-case.
 */

import {
  AlertTriangle,
  Ban,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Clock,
  Coins,
  Forward,
  Handshake,
  HeartHandshake,
  HelpCircle,
  Landmark,
  PhoneMissed,
  PhoneOff,
  ShieldAlert,
  UserX,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { humanize } from "./format";

/** Badge tones — same keys as the TONES map in `components/status-badges.tsx`. */
export type MetaTone =
  | "neutral"
  | "success"
  | "info"
  | "progress"
  | "warning"
  | "danger"
  | "muted";

export interface StatusMeta {
  label: string;
  tone: MetaTone;
  icon: LucideIcon;
  /** Short tooltip explaining what the status means operationally. */
  hint: string;
}

function meta(
  label: string,
  tone: MetaTone,
  icon: LucideIcon,
  hint: string,
): StatusMeta {
  return { label, tone, icon, hint };
}

const FALLBACK_ICON = CircleDashed;

/** Generic lookup that tolerates casing differences from the wire format. */
export function lookupMeta(
  map: Record<string, StatusMeta>,
  value: string | null | undefined,
): StatusMeta {
  if (!value) {
    return meta("—", "muted", FALLBACK_ICON, "No value recorded.");
  }
  const key = value.toUpperCase();
  return (
    map[key] ??
    meta(humanize(value.toLowerCase()), "neutral", FALLBACK_ICON, "Unrecognised status value.")
  );
}

// ---------- Conversational / recovery outcomes (spec §18) ----------

export const OUTCOME_META: Record<string, StatusMeta> = {
  PAID: meta("Paid", "success", Coins, "Customer confirmed a payment was made."),
  PROMISE_TO_PAY: meta("Promise to pay", "info", Handshake, "Customer committed to pay by a stated date."),
  PAYMENT_INTENT: meta("Payment intent", "info", Landmark, "Customer signalled willingness to pay."),
  CALLBACK: meta("Callback", "progress", CalendarClock, "Customer asked to be called back later."),
  ALREADY_PAID: meta("Already paid", "success", CheckCircle2, "Customer claims the amount was already settled — verification pending."),
  DISPUTE: meta("Dispute", "danger", ShieldAlert, "Customer disputed the debt or amount."),
  WRONG_NUMBER: meta("Wrong number", "warning", PhoneOff, "The dialed number does not reach the customer."),
  WRONG_PERSON: meta("Wrong person", "warning", UserX, "The person reached is not the customer."),
  REFUSED: meta("Refused", "warning", Ban, "Customer explicitly refused to pay."),
  HARDSHIP: meta("Hardship", "warning", HeartHandshake, "Customer reported financial hardship."),
  NO_ANSWER: meta("No answer", "neutral", PhoneMissed, "Call rang but was not answered."),
  BUSY: meta("Busy", "neutral", Clock, "Line was busy."),
  FAILED: meta("Failed", "danger", XCircle, "Call could not be completed."),
  TRANSFERRED: meta("Transferred", "progress", Forward, "Call was transferred to a human agent."),
  ESCALATED: meta("Escalated", "danger", AlertTriangle, "Conversation was escalated for human review."),
};

// ---------- Payment intent states (spec §13) ----------

export const PAYMENT_INTENT_META: Record<string, StatusMeta> = {
  UNKNOWN: meta("Unknown", "muted", HelpCircle, "No intent signal captured yet."),
  NO_INTENT: meta("No intent", "neutral", Ban, "Customer declined to commit."),
  PARTIAL_PAYMENT: meta("Partial payment", "warning", Coins, "Customer offered a part payment."),
  FULL_PAYMENT: meta("Full payment", "success", CheckCircle2, "Customer committed to the full outstanding amount."),
  PROMISE_TO_PAY: meta("Promise to pay", "info", Handshake, "Customer promised to pay by a date."),
  ALREADY_PAID: meta("Already paid", "success", CheckCircle2, "Customer claims payment was already made — verification pending."),
  PAYMENT_PENDING_VERIFICATION: meta("Pending verification", "warning", Clock, "Claimed payment awaiting backend verification."),
};

// ---------- PTP (spec §12) ----------

export const PTP_META: Record<string, StatusMeta> = {
  PENDING: meta("Pending", "neutral", Clock, "Promise recorded, awaiting confirmation."),
  CONFIRMED: meta("Confirmed", "info", CheckCircle2, "Promise confirmed by the customer."),
  DUE: meta("Due", "warning", CalendarClock, "Promise date reached, payment not yet received."),
  PAID: meta("Paid", "success", Coins, "Promise fulfilled with a verified payment."),
  BROKEN: meta("Broken", "danger", XCircle, "Promise date passed without a verified payment."),
  CANCELLED: meta("Cancelled", "muted", Ban, "Promise was cancelled."),
};

// ---------- Callbacks (spec §14) ----------

export const CALLBACK_META: Record<string, StatusMeta> = {
  SCHEDULED: meta("Scheduled", "info", CalendarClock, "Callback scheduled for a future window."),
  DUE: meta("Due", "warning", Clock, "Callback window has started."),
  IN_PROGRESS: meta("In progress", "progress", PhoneMissed, "Callback call is being placed."),
  COMPLETED: meta("Completed", "success", CheckCircle2, "Callback completed."),
  MISSED: meta("Missed", "danger", PhoneMissed, "Callback window passed without a completed call."),
  CANCELLED: meta("Cancelled", "muted", Ban, "Callback was cancelled."),
};

// ---------- Disputes (spec §15) ----------

export const DISPUTE_META: Record<string, StatusMeta> = {
  OPEN: meta("Open", "warning", ShieldAlert, "Dispute recorded and awaiting triage."),
  UNDER_REVIEW: meta("Under review", "progress", Clock, "A human reviewer is investigating."),
  RESOLVED: meta("Resolved", "success", CheckCircle2, "Dispute was resolved."),
  REJECTED: meta("Rejected", "muted", Ban, "Dispute was reviewed and rejected."),
  ESCALATED: meta("Escalated", "danger", AlertTriangle, "Dispute was escalated to a senior team."),
};

export const DISPUTE_TYPES = [
  "WRONG_AMOUNT",
  "ALREADY_PAID",
  "WRONG_PERSON",
  "WRONG_ACCOUNT",
  "IDENTITY_CONCERN",
  "SERVICE_COMPLAINT",
  "PAYMENT_ISSUE",
  "OTHER",
] as const;

// ---------- Escalations (spec §16) ----------

export const ESCALATION_META: Record<string, StatusMeta> = {
  OPEN: meta("Open", "warning", AlertTriangle, "Awaiting assignment."),
  IN_PROGRESS: meta("In progress", "progress", Clock, "Assigned and being handled."),
  RESOLVED: meta("Resolved", "success", CheckCircle2, "Handled by a human agent."),
  CLOSED: meta("Closed", "muted", Ban, "Closed without further action."),
};

export const ESCALATION_REASONS = [
  "CUSTOMER_REQUESTED_HUMAN",
  "DISPUTE",
  "HARDSHIP",
  "REPEATED_FAILED_ATTEMPTS",
  "SENSITIVE_ISSUE",
  "AI_UNCERTAINTY",
  "OTHER",
] as const;

export const PRIORITY_META: Record<string, StatusMeta> = {
  LOW: meta("Low", "muted", CircleDashed, "Low priority."),
  NORMAL: meta("Normal", "neutral", CircleDashed, "Standard priority."),
  HIGH: meta("High", "warning", AlertTriangle, "High priority."),
  URGENT: meta("Urgent", "danger", AlertTriangle, "Urgent — handle first."),
};

// ---------- Follow-ups (spec §21) ----------

export const FOLLOW_UP_META: Record<string, StatusMeta> = {
  SCHEDULED: meta("Scheduled", "info", CalendarClock, "Waiting for its scheduled time."),
  RUNNING: meta("Running", "progress", Clock, "Executing now."),
  COMPLETED: meta("Completed", "success", CheckCircle2, "Executed successfully."),
  FAILED: meta("Failed", "danger", XCircle, "Execution failed — can be retried."),
  CANCELLED: meta("Cancelled", "muted", Ban, "Cancelled before execution."),
  SKIPPED: meta("Skipped", "muted", Forward, "Skipped because its condition no longer applied."),
};

export const FOLLOW_UP_TRIGGERS = [
  "NO_ANSWER",
  "BUSY",
  "CALLBACK",
  "PTP",
  "DISPUTE",
  "REFUSAL",
  "ALREADY_PAID",
  "WRONG_NUMBER",
  "HARDSHIP",
] as const;

// ---------- Recovery queue (spec §11) ----------

export const QUEUE_META: Record<string, StatusMeta> = {
  PENDING: meta("Pending", "neutral", Clock, "Waiting to enter the dialing window."),
  READY: meta("Ready", "info", CheckCircle2, "Eligible for the next dial."),
  IN_PROGRESS: meta("In progress", "progress", Forward, "A call is being attempted now."),
  CALLBACK: meta("Callback", "warning", CalendarClock, "Waiting for a scheduled callback."),
  FOLLOW_UP: meta("Follow-up", "info", CalendarClock, "Waiting on an automated follow-up."),
  PAUSED: meta("Paused", "warning", CircleDashed, "Paused by an operator."),
  COMPLETED: meta("Completed", "success", CheckCircle2, "Reached a terminal outcome."),
  ESCALATED: meta("Escalated", "danger", AlertTriangle, "Moved to the human escalation queue."),
  CLOSED: meta("Closed", "muted", Ban, "Closed without recovery."),
};

// ---------- Exports (spec §24) ----------

export const EXPORT_STATUS_META: Record<string, StatusMeta> = {
  QUEUED: meta("Queued", "neutral", Clock, "Waiting for the backend to generate the file."),
  RUNNING: meta("Running", "progress", Clock, "File is being generated."),
  COMPLETED: meta("Completed", "success", CheckCircle2, "Ready to download."),
  FAILED: meta("Failed", "danger", XCircle, "Generation failed — retry the export."),
};

// ---------- Campaign statuses (Phase 3 set, spec §5) ----------

export const CAMPAIGN_STATUS_META: Record<string, StatusMeta> = {
  DRAFT: meta("Draft", "neutral", CircleDashed, "Being configured — not dialing."),
  READY: meta("Ready", "info", CheckCircle2, "Configured and ready to start."),
  RUNNING: meta("Running", "success", Forward, "Actively dialing leads."),
  PAUSED: meta("Paused", "warning", Clock, "Temporarily paused — resume to continue."),
  COMPLETED: meta("Completed", "info", CheckCircle2, "All leads reached a terminal outcome."),
  STOPPED: meta("Stopped", "danger", XCircle, "Stopped by an operator — will not resume."),
  FAILED: meta("Failed", "danger", AlertTriangle, "Could not run — inspect the error before restarting."),
};

// ---------- Automation (spec §19) ----------

export const AUTOMATION_TRIGGER_LABELS: Record<string, string> = {
  NO_ANSWER: "No answer",
  BUSY: "Busy",
  FAILED: "Failed call",
  CALLBACK: "Callback due",
  PTP_CREATED: "PTP created",
  PTP_DUE: "PTP due date reached",
  PTP_BROKEN: "PTP broken",
  DISPUTE: "Dispute created",
  REFUSAL: "Refusal",
  HARDSHIP: "Hardship",
  ALREADY_PAID: "Already paid",
  WRONG_NUMBER: "Wrong number",
  ESCALATION_CREATED: "Escalation created",
};

export const AUTOMATION_ACTION_LABELS: Record<string, string> = {
  SCHEDULE_RETRY: "Schedule retry",
  SCHEDULE_CALLBACK: "Schedule callback",
  CREATE_FOLLOW_UP: "Create follow-up",
  CREATE_ESCALATION: "Create escalation",
  REQUEST_PAYMENT_VERIFICATION: "Request payment verification",
  CLOSE_LEAD: "Close lead",
};

export const AUTOMATION_CONDITION_FIELDS = [
  { value: "ptp_due_in_days", label: "PTP due within (days)" },
  { value: "attempts", label: "Attempt count" },
  { value: "outstanding_amount", label: "Outstanding amount" },
  { value: "days_overdue", label: "Days overdue" },
] as const;

// ---------- Campaign lead statuses ----------

export const LEAD_STATUS_META: Record<string, StatusMeta> = {
  PENDING: meta("Pending", "neutral", Clock, "Not yet attempted."),
  QUEUED: meta("Queued", "info", CheckCircle2, "Queued for dialing."),
  IN_PROGRESS: meta("In progress", "progress", Forward, "Being dialed now."),
  CALLBACK: meta("Callback", "warning", CalendarClock, "Waiting for a callback."),
  FOLLOW_UP: meta("Follow-up", "info", CalendarClock, "Waiting on a follow-up action."),
  COMPLETED: meta("Completed", "success", CheckCircle2, "Reached a terminal outcome."),
  PAUSED: meta("Paused", "warning", CircleDashed, "Paused by an operator."),
  SKIPPED: meta("Skipped", "muted", Forward, "Skipped — ineligible or opted out."),
  FAILED: meta("Failed", "danger", XCircle, "Exhausted attempts without success."),
};

// ---------- Campaign types (wizard) ----------

export const CAMPAIGN_TYPES = [
  { value: "OUTBOUND_AI", label: "Outbound AI" },
  { value: "CALLBACK_RECOVERY", label: "Callback recovery" },
  { value: "PTP_CONFIRMATION", label: "PTP confirmation" },
  { value: "PAYMENT_VERIFICATION", label: "Payment verification" },
] as const;

export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "hinglish", label: "Hinglish" },
] as const;

// ---------- Convenience helpers ----------

export const outcomeMeta = (value: string | null | undefined) => lookupMeta(OUTCOME_META, value);
export const paymentIntentMeta = (value: string | null | undefined) => lookupMeta(PAYMENT_INTENT_META, value);
export const ptpMeta = (value: string | null | undefined) => lookupMeta(PTP_META, value);
export const callbackMeta = (value: string | null | undefined) => lookupMeta(CALLBACK_META, value);
export const disputeMeta = (value: string | null | undefined) => lookupMeta(DISPUTE_META, value);
export const escalationMeta = (value: string | null | undefined) => lookupMeta(ESCALATION_META, value);
export const priorityMeta = (value: string | null | undefined) => lookupMeta(PRIORITY_META, value);
export const followUpMeta = (value: string | null | undefined) => lookupMeta(FOLLOW_UP_META, value);
export const queueMeta = (value: string | null | undefined) => lookupMeta(QUEUE_META, value);
export const exportStatusMeta = (value: string | null | undefined) => lookupMeta(EXPORT_STATUS_META, value);
export const campaignStatusMeta = (value: string | null | undefined) => lookupMeta(CAMPAIGN_STATUS_META, value);
export const leadStatusMeta = (value: string | null | undefined) => lookupMeta(LEAD_STATUS_META, value);

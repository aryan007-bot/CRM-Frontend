/**
 * Domain types — mirror of the future FastAPI/pydantic schemas.
 * Keep this file as the single source of truth for API contracts.
 * The mock API (lib/api.ts) implements these shapes; when the real
 * backend lands, swap the client internals — no UI changes needed.
 */

// ---------- Campaigns ----------

export type CampaignStatus = "draft" | "active" | "paused" | "completed";

export type DialMode = "predictive" | "progressive" | "preview";

export type Weekday =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun";

export interface CampaignSchedule {
  /** ISO-8601 weekday keys the campaign is allowed to dial */
  days: Weekday[];
  /** Local start hour, 0-23 */
  startHour: number;
  /** Local end hour, 0-23 */
  endHour: number;
  timezone: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  dialMode: DialMode;
  /** Max simultaneous lines */
  concurrency: number;
  /** Max attempts per contact before archival */
  maxAttempts: number;
  schedule: CampaignSchedule;
  /** Contact ids queued into this campaign */
  contactIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignStats {
  queued: number;
  callsToday: number;
  connectRate: number;
  aiResolutionRate: number;
  promiseRate: number;
}

// ---------- Contacts ----------

export type ContactStatus =
  | "new"
  | "in_progress"
  | "promised_to_pay"
  | "payment_arranged"
  | "callback"
  | "disputed"
  | "do_not_call"
  | "closed";

export interface Contact {
  id: string;
  accountRef: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  status: ContactStatus;
  /** Outstanding balance in USD */
  balanceDue: number;
  /** Age of the debt in days */
  debtAgeDays: number;
  timezone: string;
  attempts: number;
  lastContactedAt: string | null;
  /** Regulatory flags */
  tcpaConsent: boolean;
  fdcpaEligible: boolean;
  notes: string;
}

// ---------- Calls ----------

export type CallOutcome =
  | "ai_resolved"
  | "promise_to_pay"
  | "human_takeover"
  | "callback_scheduled"
  | "no_answer"
  | "voicemail"
  | "busy"
  | "failed";

export type Sentiment = "positive" | "neutral" | "negative";

export interface TranscriptTurn {
  speaker: "ai" | "contact";
  /** Seconds offset from call start */
  atSec: number;
  text: string;
}

export interface Call {
  id: string;
  campaignId: string;
  contactId: string;
  startedAt: string;
  durationSec: number;
  outcome: CallOutcome;
  sentiment: Sentiment;
  /** Short AI-generated wrap-up summary (empty when not connected) */
  aiSummary: string;
  transcript: TranscriptTurn[];
}

// ---------- Live console ----------

export type LiveCallState =
  | "dialing"
  | "talking"
  | "hold"
  | "transferring"
  | "wrap_up";

export interface LiveCall {
  id: string;
  campaignId: string;
  contactId: string;
  state: LiveCallState;
  /** Seconds since the call started */
  elapsedSec: number;
  sentiment: Sentiment;
  /** 0-1 confidence from the AI conversation model */
  aiConfidence: number;
  agent: string;
}

// ---------- Dashboard ----------

export interface DashboardStats {
  kpis: {
    activeCampaigns: number;
    callsToday: number;
    connectRate: number;
    aiResolutionRate: number;
    promisedToday: number;
    promisedAmount: number;
  };
  /** Calls per hour, today */
  hourly: { hour: string; calls: number; connected: number }[];
  /** Outcome mix, last 7 days */
  outcomes: { outcome: CallOutcome; count: number }[];
  /** Calls per day, last 14 days */
  daily: { date: string; calls: number; connected: number }[];
  recentCalls: Call[];
}

// ---------- Settings ----------

export interface QuietHours {
  startHour: number;
  endHour: number;
}

export interface OrgSettings {
  businessName: string;
  timezone: string;
  /** Weekly dialing window */
  dialingDays: Weekday[];
  dialingStartHour: number;
  dialingEndHour: number;
  ai: {
    personaName: string;
    voiceModel: string;
    speechRate: number;
    empathyLevel: "low" | "balanced" | "high";
    greetingScript: string;
    escalationToHuman: boolean;
  };
  compliance: {
    quietHours: QuietHours;
    maxAttemptsPerDay: number;
    minDaysBetweenAttempts: number;
    recordingDisclosure: boolean;
    honorDncList: boolean;
    autoPurgeDays: number;
  };
}

// ---------- API envelope ----------

export interface Paginated<T> {
  items: T[];
  total: number;
}

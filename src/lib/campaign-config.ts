/**
 * Campaign wizard configuration model (spec §6, §20, §26).
 *
 * Zod validates each step inline; the backend remains authoritative and may
 * still reject values with `CALLING_POLICY_BLOCKED` etc. Money fields stay
 * decimal strings end-to-end.
 */

import { z } from "zod";

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Use a decimal amount like 15000.00");

const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");

export const campaignDetailsSchema = z.object({
  name: z.string().min(3, "Use at least 3 characters").max(120),
  description: z.string().max(2000).optional().or(z.literal("")),
  /** Optional: a fresh organization may not have creditors yet. */
  creditor_id: z.string().uuid().nullable().optional(),
  campaign_type: z.string().min(1, "Choose a campaign type"),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  timezone: z.string().min(1, "Choose a timezone"),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date"),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an end date")
    .optional()
    .or(z.literal("")),
});

export const leadSourceSchema = z.object({
  source_mode: z.enum(["accounts", "filters"]),
  account_ids: z.array(z.string().uuid()).default([]),
  filters: z
    .object({
      min_outstanding: decimalString.optional().or(z.literal("")),
      max_outstanding: decimalString.optional().or(z.literal("")),
      due_date_from: z.string().optional().or(z.literal("")),
      due_date_to: z.string().optional().or(z.literal("")),
      min_days_overdue: z.number().int().min(0).optional(),
      account_status: z.string().optional(),
      previous_outcome: z.string().optional(),
      ptp_status: z.string().optional(),
      callback_status: z.string().optional(),
      payment_status: z.string().optional(),
    })
    .default({}),
});

export const dialingSchema = z
  .object({
    max_attempts: z.number().int().min(1, "At least 1").max(15),
    retry_delay_minutes: z.number().int().min(15, "Cooldown must be at least 15 minutes").max(1440),
    retry_on_no_answer: z.boolean(),
    retry_on_busy: z.boolean(),
    retry_on_failed: z.boolean(),
    max_daily_attempts: z.number().int().min(1).max(20),
    campaign_max_attempts: z.number().int().min(1).max(100000),
    cooldown_minutes: z.number().int().min(0).max(10080),
    calling_start_time: timeString,
    calling_end_time: timeString,
    enforce_dnc: z.boolean(),
    recording_disclosure: z.boolean(),
    ai_disclosure: z.boolean(),
    identity_verification: z.boolean(),
  })
  .refine((v) => v.calling_start_time < v.calling_end_time, {
    message: "Start must be before end",
    path: ["calling_end_time"],
  })
  .refine((v) => v.enforce_dnc, {
    message: "DNC/opt-out enforcement must stay enabled for policy compliance",
    path: ["enforce_dnc"],
  });

export const strategySchema = z.object({
  /** Optional at creation; the backend binds the agent when dialing starts. */
  agent_id: z.string().uuid().nullable().optional(),
  language: z.enum(["en", "hi", "hinglish"]),
  strategy: z.enum(["SOFT", "FIRM", "EMPATHETIC"]),
  human_escalation: z.boolean(),
  collect_callback: z.boolean(),
  collect_payment_intent: z.boolean(),
  handle_disputes: z.boolean(),
  follow_ups_enabled: z.boolean(),
});

export const followUpSchema = z.object({
  rules: z
    .array(
      z.object({
        trigger: z.string().min(1),
        action: z.string().min(1),
        delay_minutes: z.number().int().min(0).max(10080),
        enabled: z.boolean(),
      }),
    )
    .default([]),
});

export const campaignWizardSchema = z.object({
  details: campaignDetailsSchema,
  leadSource: leadSourceSchema,
  dialing: dialingSchema,
  strategy: strategySchema,
  followUps: followUpSchema,
});

export type CampaignWizardConfig = z.infer<typeof campaignWizardSchema>;
export type CampaignDetailsStep = z.infer<typeof campaignDetailsSchema>;
export type LeadSourceStep = z.infer<typeof leadSourceSchema>;
export type DialingStep = z.infer<typeof dialingSchema>;
export type StrategyStep = z.infer<typeof strategySchema>;
export type FollowUpStep = z.infer<typeof followUpSchema>;

export const DEFAULT_WIZARD_CONFIG: CampaignWizardConfig = {
  details: {
    name: "",
    description: "",
    creditor_id: null,
    campaign_type: "OUTBOUND_AI",
    priority: "NORMAL",
    timezone: "Asia/Kolkata",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
  },
  leadSource: {
    source_mode: "filters",
    account_ids: [],
    filters: {},
  },
  dialing: {
    max_attempts: 3,
    retry_delay_minutes: 240,
    retry_on_no_answer: true,
    retry_on_busy: true,
    retry_on_failed: false,
    max_daily_attempts: 3,
    campaign_max_attempts: 3,
    cooldown_minutes: 240,
    calling_start_time: "09:00",
    calling_end_time: "19:00",
    enforce_dnc: true,
    recording_disclosure: true,
    ai_disclosure: true,
    identity_verification: true,
  },
  strategy: {
    agent_id: null,
    language: "en",
    strategy: "EMPATHETIC",
    human_escalation: true,
    collect_callback: true,
    collect_payment_intent: true,
    handle_disputes: true,
    follow_ups_enabled: true,
  },
  followUps: {
    rules: [
      { trigger: "NO_ANSWER", action: "SCHEDULE_RETRY", delay_minutes: 240, enabled: true },
      { trigger: "BUSY", action: "SCHEDULE_RETRY", delay_minutes: 120, enabled: true },
      { trigger: "CALLBACK", action: "SCHEDULE_CALLBACK", delay_minutes: 0, enabled: true },
      { trigger: "PTP", action: "CREATE_FOLLOW_UP", delay_minutes: 1440, enabled: true },
      { trigger: "DISPUTE", action: "CREATE_ESCALATION", delay_minutes: 0, enabled: true },
      { trigger: "REFUSAL", action: "CLOSE_LEAD", delay_minutes: 0, enabled: false },
      { trigger: "ALREADY_PAID", action: "REQUEST_PAYMENT_VERIFICATION", delay_minutes: 60, enabled: true },
      { trigger: "WRONG_NUMBER", action: "CLOSE_LEAD", delay_minutes: 0, enabled: false },
      { trigger: "HARDSHIP", action: "CREATE_ESCALATION", delay_minutes: 0, enabled: true },
    ],
  },
};

/** Maps the wizard config onto the Phase 1 `CampaignCreate` contract. */
export function toCampaignCreate(config: CampaignWizardConfig) {
  return {
    name: config.details.name,
    description: config.details.description || null,
    timezone: config.details.timezone,
    calling_start_time: `${config.dialing.calling_start_time}:00`,
    calling_end_time: `${config.dialing.calling_end_time}:00`,
    max_attempts: config.dialing.max_attempts,
    retry_delay_minutes: config.dialing.retry_delay_minutes,
    concurrency_limit: config.dialing.max_daily_attempts,
  };
}

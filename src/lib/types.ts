/**
 * API contract types — a direct mirror of the FastAPI/Pydantic schemas.
 *
 * This is the single source of truth for the frontend. Field names, nullability
 * and wire formats must match the backend exactly:
 *   - monetary values arrive as decimal *strings* (Pydantic serializes Decimal
 *     to a string to preserve precision — never parse them into floats),
 *   - dates arrive as `YYYY-MM-DD` strings,
 *   - timestamps arrive as ISO-8601 strings.
 */

// ---------- Envelopes ----------

export interface Paginated<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

export interface Single<T> {
  data: T;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ---------- Auth & profile ----------

export type Role =
  | "SUPER_ADMIN"
  | "ORG_ADMIN"
  | "SUPERVISOR"
  | "AI_MANAGER"
  | "AGENT"
  | "VIEWER";

export interface User {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  roles: Role[];
  primary_role: Role;
  is_active: boolean;
  created_at: string;
}

/** POST /auth/login returns the token at the top level (no `data` envelope). */
export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
  organization_id: string;
  organization_name: string;
}

export interface ProfileUpdate {
  name?: string;
  email?: string;
}

// ---------- Customers ----------

export interface CustomerPhone {
  id: string;
  phone: string;
  normalized_phone: string;
  phone_type: string;
  is_primary: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  status: string;
  phones: CustomerPhone[];
  created_at: string;
  updated_at: string;
}

export interface CustomerPhoneInput {
  phone: string;
  phone_type?: string;
  is_primary?: boolean;
}

export interface CustomerCreate {
  name: string;
  email?: string | null;
  status?: string;
  phones?: CustomerPhoneInput[];
}

export interface CustomerUpdate {
  name?: string;
  email?: string | null;
  status?: string;
}

// ---------- Creditors ----------

export interface Creditor {
  id: string;
  organization_id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// ---------- Accounts ----------

export interface AccountPayment {
  id: string;
  account_id: string;
  amount: string;
  currency: string;
  payment_date: string;
  reference: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface Account {
  id: string;
  organization_id: string;
  customer_id: string;
  creditor_id: string | null;
  account_number: string;
  outstanding_amount: string;
  currency: string;
  due_date: string | null;
  status: string;
  customer_name: string | null;
  creditor_name: string | null;
  payments: AccountPayment[];
  created_at: string;
  updated_at: string;
}

export interface AccountCreate {
  customer_id: string;
  creditor_id?: string | null;
  account_number: string;
  outstanding_amount: string;
  currency?: string;
  due_date?: string | null;
  status?: string;
}

export interface AccountUpdate {
  outstanding_amount?: string;
  due_date?: string | null;
  status?: string;
  creditor_id?: string | null;
}

export interface PaymentCreate {
  amount: string;
  currency?: string;
  payment_date?: string | null;
  reference?: string | null;
  status?: string;
  notes?: string | null;
}

// ---------- Imports ----------

export interface ImportJob {
  id: string;
  organization_id: string;
  filename: string;
  file_type: string;
  status: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  imported_rows: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportDetail extends ImportJob {
  detected_columns: string[];
  suggested_mapping: Partial<Record<MappingField, string | null>>;
}

export interface UploadResult {
  import_id: string;
  filename: string;
  file_type: string;
  detected_columns: string[];
  row_count: number;
  /** Server-side suggestions; values may be null when no alias matched. */
  suggested_mapping: Partial<Record<MappingField, string | null>>;
}

export interface ValidationErrorItem {
  row: number;
  field: string;
  code: string;
  message: string;
}

export interface ValidateSummary {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
}

export interface ValidateResult {
  summary: ValidateSummary;
  warnings: string[];
  errors: ValidationErrorItem[];
  preview: Record<string, unknown>[];
}

export interface ConfirmImportResult {
  import_id: string;
  status: string;
  imported_rows: number;
  total_rows: number;
}

/** Standard field keys accepted by the column-mapping endpoint. */
export type MappingField =
  | "customer_name"
  | "phone"
  | "account_number"
  | "outstanding_amount"
  | "due_date"
  | "creditor_name"
  | "email";

export type ColumnMapping = Partial<Record<MappingField, string>>;

// ---------- Campaigns ----------

export interface Campaign {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  status: string;
  timezone: string;
  calling_start_time: string;
  calling_end_time: string;
  max_attempts: number;
  retry_delay_minutes: number;
  concurrency_limit: number;
  total_leads: number;
  created_at: string;
  updated_at: string;
}

/** Phase 3 campaign with outcome counters (optional until the backend sends them). */
export interface CampaignWithCounters extends Campaign {
  attempted_leads?: number | null;
  connected_leads?: number | null;
  promised_leads?: number | null;
  paid_leads?: number | null;
  disputed_leads?: number | null;
  escalated_leads?: number | null;
  creditor_id?: string | null;
  creditor_name?: string | null;
  campaign_type?: string | null;
  priority?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface CampaignCreate {
  name: string;
  description?: string | null;
  timezone?: string;
  calling_start_time?: string;
  calling_end_time?: string;
  max_attempts?: number;
  retry_delay_minutes?: number;
  concurrency_limit?: number;
}

export interface CampaignUpdate extends Partial<CampaignCreate> {
  status?: string;
}

export interface CampaignLead {
  id: string;
  campaign_id: string;
  account_id: string;
  account_number: string | null;
  customer_name: string | null;
  outstanding_amount: string | null;
  status: string;
  priority: number;
  created_at: string;
}

export interface AddLeadsResult {
  added_leads: number;
  campaign_id: string;
}

// ---------- Dashboard ----------

export interface DashboardSummary {
  customers: number;
  accounts: number;
  total_outstanding: string;
  active_campaigns: number;
  pending_imports: number;
}

// ---------- Query params ----------

export interface ListParams {
  page?: number;
  page_size?: number;
}

export interface CustomerListParams extends ListParams {
  search?: string;
  status?: string;
  sort_by?: string;
  sort_direction?: "asc" | "desc";
}

export interface AccountListParams extends ListParams {
  search?: string;
  status?: string;
  creditor_id?: string;
  customer_id?: string;
  due_date_from?: string;
  due_date_to?: string;
  sort_by?: string;
  sort_direction?: "asc" | "desc";
}

export interface CreditorListParams extends ListParams {
  search?: string;
  status?: string;
}

export interface ImportListParams extends ListParams {
  status?: string;
}

export interface CampaignListParams extends ListParams {
  status?: string;
}

export interface CampaignLeadListParams extends ListParams {
  status?: string;
}

// ---------- Phase 2: AI Agents & Voice Profiles ----------

export interface VoiceProfile {
  id: string;
  agent_id: string;
  name: string;
  provider: string;
  sample_rate: number;
  duration_seconds: string | null;
  status: "PENDING" | "READY" | "FAILED";
  created_at: string;
}

export interface AiAgent {
  id: string;
  organization_id: string;
  name: string;
  language: string;
  model: string;
  system_prompt: string;
  disclosure: string;
  status: "DRAFT" | "READY" | "INACTIVE";
  is_active: boolean;
  voice_profile: VoiceProfile | null;
  created_at: string;
  updated_at: string;
}

export interface AiAgentCreate {
  name: string;
  language?: string;
  model?: string;
  system_prompt: string;
  disclosure: string;
}

export interface AiAgentUpdate {
  name?: string;
  language?: string;
  model?: string;
  system_prompt?: string;
  disclosure?: string;
  status?: string;
  is_active?: boolean;
}

export interface VoicePreviewRequest {
  text: string;
}

export interface VoicePreviewResponse {
  audio_base64: string;
  sample_rate: number;
  duration_seconds: number;
  format: string;
}

// ---------- Phase 2: Telephony & AI Status ----------

export interface TelephonyGateway {
  id: string;
  organization_id: string;
  name: string;
  gateway_type: "GSM" | "SIP" | "WEBRTC";
  host: string;
  port: number;
  status: "ONLINE" | "OFFLINE" | "BUSY" | "ERROR";
  signal_strength: number | null;
  network_operator: string | null;
  active_channels: number;
  last_seen_at: string;
  created_at: string;
}

export interface TelephonyGatewayCreate {
  name: string;
  gateway_type?: string;
  host?: string;
  port?: number;
}

export interface TelephonyStatus {
  asterisk_status: string;
  active_channels: number;
  gateways_online: number;
  gateways_total: number;
}

export interface AiServiceStatus {
  service_type: "STT" | "LLM" | "TTS" | "VAD" | "ASTERISK";
  provider: string;
  model: string | null;
  status: "HEALTHY" | "DEGRADED" | "UNAVAILABLE";
  latency_ms: number | null;
  last_checked_at: string;
}

export interface AiStatusSummary {
  services: AiServiceStatus[];
  overall_status: string;
}

// ---------- Phase 2: Calls, Events & Transcripts ----------

export type CallStatus =
  | "created"
  | "connecting"
  | "ringing"
  | "connected"
  | "ai_talking"
  | "customer_talking"
  | "on_hold"
  | "transferring"
  | "human_connected"
  | "ending"
  | "ended"
  | "failed";

export type CallDisposition =
  | "COMPLETED"
  | "CALLBACK"
  | "TRANSFERRED"
  | "FAILED"
  | "WRONG_NUMBER"
  | "NO_ANSWER"
  | "BUSY";

export interface CallEvent {
  id: string;
  call_id: string;
  sequence: number;
  event_type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface TranscriptMessage {
  id: string;
  call_id: string;
  speaker: "ai" | "customer" | "agent" | "system";
  text: string;
  is_final: boolean;
  confidence: string | null;
  start_time_offset: string | null;
  end_time_offset: string | null;
  timestamp: string;
}

export interface LiveCall {
  id: string;
  organization_id: string;
  customer_id: string;
  account_id: string | null;
  campaign_id: string | null;
  agent_id: string | null;
  gateway_id: string | null;
  assigned_user_id: string | null;
  caller_phone: string;
  recipient_phone: string;
  direction: "OUTBOUND" | "INBOUND";
  status: CallStatus;
  disposition: CallDisposition | null;
  duration_seconds: number;
  customer_name: string | null;
  agent_name: string | null;
  account_number: string | null;
  outstanding_amount: string | null;
  start_time: string | null;
  answered_time: string | null;
  end_time: string | null;
  created_at: string;
}

export interface CallDetail extends LiveCall {
  events: CallEvent[];
  transcripts: TranscriptMessage[];
}

export interface CallCreate {
  customer_id: string;
  account_id?: string | null;
  campaign_id?: string | null;
  agent_id?: string | null;
  recipient_phone: string;
  caller_phone?: string;
}

export interface CallDispositionUpdate {
  disposition: CallDisposition;
  notes?: string | null;
}

export interface CallTransferRequest {
  target_user_id?: string | null;
  target_extension?: string | null;
}

export interface TranscriptMessageCreate {
  speaker: "ai" | "customer" | "agent" | "system";
  text: string;
  is_final?: boolean;
  confidence?: string | null;
}

export interface WebSocketEvent<T = unknown> {
  call_id: string;
  sequence: number;
  timestamp: string;
  event: string;
  data: T;
}

// ---------- Phase 3: recovery outcomes & operations ----------

/** Conversational outcome classes reported by the AI pipeline. */
export type RecoveryOutcomeCode =
  | "PAID"
  | "PROMISE_TO_PAY"
  | "PAYMENT_INTENT"
  | "CALLBACK"
  | "ALREADY_PAID"
  | "DISPUTE"
  | "WRONG_NUMBER"
  | "WRONG_PERSON"
  | "REFUSED"
  | "HARDSHIP"
  | "NO_ANSWER"
  | "BUSY"
  | "FAILED"
  | "TRANSFERRED"
  | "ESCALATED";

/** What the AI *heard* — always separate from verified backend state. */
export type PaymentIntentState =
  | "UNKNOWN"
  | "NO_INTENT"
  | "PARTIAL_PAYMENT"
  | "FULL_PAYMENT"
  | "PROMISE_TO_PAY"
  | "ALREADY_PAID"
  | "PAYMENT_PENDING_VERIFICATION";

export type PtpStatus =
  | "PENDING"
  | "CONFIRMED"
  | "DUE"
  | "PAID"
  | "BROKEN"
  | "CANCELLED";

export type CallbackStatus =
  | "SCHEDULED"
  | "DUE"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "MISSED"
  | "CANCELLED";

export type DisputeStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "RESOLVED"
  | "REJECTED"
  | "ESCALATED";

export type EscalationStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export type FollowUpStatus =
  | "SCHEDULED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "SKIPPED";

export type ExportStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";

export type RecoveryQueueStatus =
  | "PENDING"
  | "READY"
  | "IN_PROGRESS"
  | "CALLBACK"
  | "FOLLOW_UP"
  | "PAUSED"
  | "COMPLETED"
  | "ESCALATED"
  | "CLOSED";

/** Campaign-level metrics returned by `/campaigns/{id}/metrics`. */
export interface CampaignMetrics {
  campaign_id: string;
  total_leads: number;
  pending: number;
  attempted: number;
  connected: number;
  conversations: number;
  promised: number;
  paid: number;
  disputed: number;
  callbacks: number;
  escalations: number;
  follow_ups_pending: number;
}

export interface OutcomeCount {
  outcome: string;
  count: number;
}

export interface IntentCount {
  intent: string;
  count: number;
}

export interface DistributionSet {
  recovery_outcomes: OutcomeCount[];
  call_outcomes: OutcomeCount[];
  payment_intents: IntentCount[];
}

export interface CampaignActivityItem {
  id: string;
  action: string;
  actor: string | null;
  detail: string | null;
  created_at: string;
}

export interface CampaignLeadFilterInput {
  creditor_id?: string | null;
  min_outstanding?: string | null;
  max_outstanding?: string | null;
  due_date_from?: string | null;
  due_date_to?: string | null;
  min_days_overdue?: number | null;
  max_days_overdue?: number | null;
  account_status?: string | null;
  previous_outcome?: string | null;
  ptp_status?: string | null;
  callback_status?: string | null;
  payment_status?: string | null;
}

export interface CampaignLeadUpdate {
  status?: string;
  priority?: number;
}

export interface LeadFilterStats {
  total: number;
  eligible: number;
  blocked: number;
  warnings: number;
  errors: number;
}

/** Lead-eligibility preview from the wizard's lead-source step. */
export interface LeadPreviewResult {
  stats: LeadFilterStats;
  account_ids: string[];
}

export interface CampaignLeadMetrics {
  attempts: number;
  last_outcome: string | null;
  payment_intent: string | null;
  ptp_status: string | null;
  callback_status: string | null;
  dispute_status: string | null;
}

export interface CampaignLeadDetail extends CampaignLead {
  phone: string | null;
  creditor_name: string | null;
  due_date: string | null;
  days_overdue: number | null;
  last_attempt_at: string | null;
  metrics: CampaignLeadMetrics | null;
}

export interface RecoveryQueueItem {
  id: string;
  campaign_id: string | null;
  campaign_name: string | null;
  account_id: string;
  account_number: string | null;
  customer_name: string | null;
  outstanding_amount: string | null;
  priority: number;
  next_action: string | null;
  next_attempt_at: string | null;
  last_outcome: string | null;
  attempts: number;
  strategy: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface RecoveryQueueListParams extends ListParams {
  status?: string;
  campaign_id?: string;
  search?: string;
}

export interface PromiseToPay {
  id: string;
  organization_id: string;
  account_id: string;
  campaign_id: string | null;
  call_id: string | null;
  customer_name: string | null;
  account_number: string | null;
  outstanding_amount: string | null;
  promised_amount: string | null;
  promised_date: string | null;
  notes: string | null;
  source: string | null;
  status: string;
  last_contact_at: string | null;
  follow_up_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PtpListParams extends ListParams {
  status?: string;
  creditor_id?: string;
  campaign_id?: string;
  due_date_from?: string;
  due_date_to?: string;
  search?: string;
}

export interface PtpUpdate {
  status?: string;
  notes?: string | null;
  promised_amount?: string;
  promised_date?: string | null;
}

export interface Callback {
  id: string;
  organization_id: string;
  account_id: string;
  campaign_id: string | null;
  call_id: string | null;
  customer_name: string | null;
  phone: string | null;
  callback_date: string | null;
  callback_window: string | null;
  reason: string | null;
  previous_outcome: string | null;
  attempts: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CallbackListParams extends ListParams {
  status?: string;
  campaign_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface CallbackCreate {
  account_id: string;
  callback_date: string;
  callback_window?: string | null;
  reason?: string | null;
  campaign_id?: string | null;
}

export interface CallbackUpdate {
  callback_date?: string;
  callback_window?: string | null;
  status?: string;
}

export interface Dispute {
  id: string;
  organization_id: string;
  account_id: string;
  campaign_id: string | null;
  call_id: string | null;
  customer_name: string | null;
  account_number: string | null;
  dispute_type: string;
  description: string | null;
  ai_classified: boolean;
  assigned_to: string | null;
  assigned_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DisputeListParams extends ListParams {
  status?: string;
  dispute_type?: string;
  campaign_id?: string;
  search?: string;
}

export interface DisputeUpdate {
  status?: string;
  assigned_to?: string | null;
  description?: string | null;
}

export interface PaymentIntent {
  id: string;
  organization_id: string;
  account_id: string;
  campaign_id: string | null;
  call_id: string | null;
  customer_name: string | null;
  account_number: string | null;
  outstanding_amount: string | null;
  intent: string;
  amount_mentioned: string | null;
  expected_payment_date: string | null;
  payment_state: string | null;
  payment_verified: boolean | null;
  source: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentIntentListParams extends ListParams {
  intent?: string;
  campaign_id?: string;
  verified?: boolean;
  search?: string;
}

export interface Escalation {
  id: string;
  organization_id: string;
  account_id: string;
  campaign_id: string | null;
  call_id: string | null;
  customer_name: string | null;
  account_number: string | null;
  reason: string;
  ai_disposition: string | null;
  priority: string;
  assigned_to: string | null;
  assigned_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface EscalationListParams extends ListParams {
  status?: string;
  priority?: string;
  campaign_id?: string;
  search?: string;
}

export interface EscalationUpdate {
  status?: string;
  assigned_to?: string | null;
  priority?: string;
}

export interface FollowUp {
  id: string;
  organization_id: string;
  campaign_id: string | null;
  account_id: string;
  customer_name: string | null;
  account_number: string | null;
  trigger: string;
  action: string;
  scheduled_at: string;
  status: string;
  source: string | null;
  last_result: string | null;
  created_at: string;
}

export interface FollowUpListParams extends ListParams {
  status?: string;
  campaign_id?: string;
  trigger?: string;
  search?: string;
}

export interface FollowUpUpdate {
  scheduled_at?: string;
  status?: string;
}

export type AutomationTrigger =
  | "NO_ANSWER"
  | "BUSY"
  | "FAILED"
  | "CALLBACK"
  | "PTP_CREATED"
  | "PTP_DUE"
  | "PTP_BROKEN"
  | "DISPUTE"
  | "REFUSAL"
  | "HARDSHIP"
  | "ALREADY_PAID"
  | "WRONG_NUMBER"
  | "ESCALATION_CREATED";

export type AutomationAction =
  | "SCHEDULE_RETRY"
  | "SCHEDULE_CALLBACK"
  | "CREATE_FOLLOW_UP"
  | "CREATE_ESCALATION"
  | "REQUEST_PAYMENT_VERIFICATION"
  | "CLOSE_LEAD";

export interface AutomationRule {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  trigger: string;
  conditions: AutomationCondition[];
  action: string;
  action_config: Record<string, string | number | boolean | null>;
  campaign_id: string | null;
  campaign_name: string | null;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  success_count: number;
  failure_count: number;
  created_at: string;
  updated_at: string;
}

export interface AutomationCondition {
  field: string;
  operator: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "within_days" | "in";
  value: string | number | boolean | null;
}

export interface AutomationRuleCreate {
  name: string;
  description?: string | null;
  trigger: string;
  conditions?: AutomationCondition[];
  action: string;
  action_config?: Record<string, string | number | boolean | null>;
  campaign_id?: string | null;
  is_active?: boolean;
}

export type AutomationRuleUpdate = Partial<AutomationRuleCreate>;

export interface AutomationExecution {
  id: string;
  rule_id: string;
  rule_name: string | null;
  account_id: string | null;
  customer_name: string | null;
  status: string;
  detail: string | null;
  created_at: string;
}

export interface AutomationListParams extends ListParams {
  trigger?: string;
  is_active?: boolean;
  campaign_id?: string;
}

export interface CallAnalysis {
  id: string;
  call_id: string;
  campaign_id: string | null;
  campaign_name: string | null;
  customer_name: string | null;
  account_number: string | null;
  duration_seconds: number;
  language: string | null;
  outcome: string | null;
  payment_intent: string | null;
  ptp_status: string | null;
  callback_status: string | null;
  dispute_flag: boolean;
  escalated: boolean;
  confidence: string | null;
  status: string;
  call_time: string;
  created_at: string;
}

export interface CallAnalysisListParams extends ListParams {
  outcome?: string;
  campaign_id?: string;
  status?: string;
  search?: string;
}

export interface CallAnalysisDetail extends CallAnalysis {
  summary: string | null;
  rationale: string | null;
  intent: string | null;
  intent_rationale: string | null;
  recovery_outcome: string | null;
  amount_mentioned: string | null;
  promised_amount: string | null;
  promised_date: string | null;
  callback_at: string | null;
  dispute_type: string | null;
  dispute_note: string | null;
  escalation_reason: string | null;
  key_events: CallAnalysisEvent[];
  evidence: CallAnalysisEvidence[];
  model: string | null;
  model_version: string | null;
}

export interface CallAnalysisEvent {
  label: string;
  at_offset_seconds: number | null;
  detail: string | null;
}

export interface CallAnalysisEvidence {
  label: string;
  transcript_offset_seconds: number | null;
  snippet: string | null;
}

export interface RecoveryAnalyticsQuery {
  date_from?: string;
  date_to?: string;
  campaign_id?: string;
  creditor_id?: string;
  outcome?: string;
}

export interface RecoveryAnalyticsSummary {
  leads_processed: number;
  calls_attempted: number;
  calls_connected: number;
  conversations_completed: number;
  no_answer: number;
  busy: number;
  failed: number;
  ptp_count: number;
  payment_intent_count: number;
  payment_confirmed_count: number;
  dispute_count: number;
  callback_count: number;
  escalation_count: number;
  total_call_seconds: number;
  total_attempts: number;
  ptp_amount: string;
  ptp_amount_confirmed: string;
}

export interface RecoveryAnalyticsResponse {
  summary: RecoveryAnalyticsSummary;
  outcomes: OutcomeCount[];
  payment_intents: IntentCount[];
  trends: TrendPoint[];
  campaigns: CampaignComparisonRow[];
}

export interface TrendPoint {
  date: string;
  calls_attempted: number;
  calls_connected: number;
  ptp_count: number;
  paid_count: number;
}

export interface CampaignComparisonRow {
  campaign_id: string;
  campaign_name: string;
  leads: number;
  attempted: number;
  connected: number;
  ptp: number;
  paid: number;
  disputed: number;
  escalated: number;
}

export interface ExportJob {
  id: string;
  organization_id: string;
  campaign_id: string | null;
  export_type: string;
  file_format: "csv" | "xlsx";
  status: string;
  row_count: number | null;
  filename: string | null;
  created_by: string | null;
  created_by_name: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExportListParams extends ListParams {
  campaign_id?: string;
  status?: string;
}

export interface ExportCreate {
  export_type: string;
  file_format: "csv" | "xlsx";
  campaign_id?: string | null;
  filters?: Record<string, string | number | boolean | null | undefined>;
}

export interface ExportPreview {
  export_type: string;
  filters: Record<string, string | number | boolean | null | undefined>;
  row_count: number;
}

// ---------- Phase 3 query params ----------

export interface CampaignListParamsV3 extends CampaignListParams {
  creditor_id?: string;
  search?: string;
  sort_by?: string;
  sort_direction?: "asc" | "desc";
}

export interface CampaignLeadListParamsV3 extends CampaignLeadListParams {
  outcome?: string;
  payment_intent?: string;
  ptp_status?: string;
  callback_status?: string;
  dispute_status?: string;
  min_attempts?: number;
  max_attempts?: number;
  min_amount?: string;
  max_amount?: string;
  due_date_from?: string;
  due_date_to?: string;
  search?: string;
}

export interface CallAnalysisFilterParams extends ListParams {
  outcome?: string;
  campaign_id?: string;
  status?: string;
  search?: string;
}


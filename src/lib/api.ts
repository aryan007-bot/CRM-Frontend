/**
 * Centralized API client for the FastAPI backend.
 *
 * Every request in the application goes through `request()` — do not add ad-hoc
 * `fetch` calls in components. Responsibilities:
 *   - build URLs and query strings from typed params,
 *   - attach the bearer token,
 *   - unwrap the `{ data: ... }` envelope so callers get the payload directly,
 *   - translate the backend error envelope `{ error: { code, message } }` into
 *     an `ApiError` carrying a user-safe message (never a stack trace).
 */

import type {
  Account,
  AccountCreate,
  AccountListParams,
  AccountPayment,
  AccountUpdate,
  AddLeadsResult,
  AiAgent,
  AutomationExecution,
  AutomationListParams,
  AutomationRule,
  AutomationRuleCreate,
  AutomationRuleUpdate,
  AiAgentCreate,
  AiAgentUpdate,
  AiStatusSummary,
  CallCreate,
  CallDetail,
  CallDispositionUpdate,
  CallTransferRequest,
  CallAnalysis,
  CallAnalysisDetail,
  CallAnalysisFilterParams,
  Campaign,
  CampaignActivityItem,
  CampaignCreate,
  CampaignLead,
  CampaignLeadDetail,
  CampaignLeadFilterInput,
  CampaignLeadListParams,
  CampaignLeadListParamsV3,
  CampaignLeadUpdate,
  CampaignListParams,
  CampaignListParamsV3,
  CampaignMetrics,
  CampaignUpdate,
  CampaignWithCounters,
  Callback,
  CallbackCreate,
  CallbackListParams,
  CallbackUpdate,
  ColumnMapping,
  ConfirmImportResult,
  Creditor,
  CreditorListParams,
  Customer,
  CustomerCreate,
  CustomerListParams,
  CustomerUpdate,
  DashboardSummary,
  DistributionSet,
  Dispute,
  DisputeListParams,
  DisputeUpdate,
  Escalation,
  EscalationListParams,
  EscalationUpdate,
  ExportCreate,
  ExportJob,
  ExportListParams,
  ExportPreview,
  FollowUp,
  FollowUpListParams,
  FollowUpUpdate,
  ImportDetail,
  ImportJob,
  ImportListParams,
  LeadPreviewResult,
  LiveCall,
  LoginResponse,
  Paginated,
  PaymentCreate,
  PaymentIntent,
  PaymentIntentListParams,
  Profile,
  ProfileUpdate,
  PromiseToPay,
  PtpListParams,
  PtpUpdate,
  RecoveryAnalyticsQuery,
  RecoveryAnalyticsResponse,
  RecoveryQueueItem,
  RecoveryQueueListParams,
  Single,
  TelephonyGateway,
  TelephonyGatewayCreate,
  TelephonyStatus,
  TranscriptMessage,
  TranscriptMessageCreate,
  UploadResult,
  User,
  ValidateResult,
  VoicePreviewResponse,
  VoiceProfile,
} from "./types";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");

const TOKEN_STORAGE_KEY = "ard.access_token";

/** Thrown for every non-2xx response and for network failures. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string = "UNKNOWN_ERROR",
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** 401/403 mean the session is gone or insufficient — send the user to login. */
  get isAuthError(): boolean {
    return this.status === 401;
  }
}

// ---------- token storage ----------

export const tokenStore = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  },
  set(token: string): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  },
  clear(): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  },
};

// ---------- internals ----------

/** Shared with the Phase 4 client. */
export type QueryValue = string | number | boolean | null | undefined;

function buildQuery(params?: Record<string, QueryValue>): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** Backend errors that have no envelope (proxy/HTML 502s, offline, CORS). */
async function toApiError(response: Response): Promise<ApiError> {
  let code = "HTTP_ERROR";
  let message = `Request failed with status ${response.status}.`;
  let details: unknown;

  try {
    const body = (await response.json()) as {
      error?: { code?: string; message?: string; details?: unknown };
      detail?: unknown;
    };
    if (body?.error?.message) {
      code = body.error.code ?? code;
      message = body.error.message;
      details = body.error.details;
    } else if (typeof body?.detail === "string") {
      message = body.detail;
    }
  } catch {
    // Non-JSON body: keep the generic message.
  }

  if (response.status === 401) {
    tokenStore.clear();
  }

  return new ApiError(message, response.status, code, details);
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: Record<string, QueryValue>;
  body?: unknown;
  /** Multipart upload; `body` is ignored when set. */
  formData?: FormData;
  auth?: boolean;
}

/** Shared with the Phase 4 control-plane client — do not call from components. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", query, body, formData, auth = true } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (auth) {
    const token = tokenStore.get();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let payload: BodyInit | undefined;
  if (formData) {
    // Let the browser set the multipart boundary.
    payload = formData;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}${buildQuery(query)}`, {
      method,
      headers,
      body: payload,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "Cannot reach the server. Check your connection and try again.",
      0,
      "NETWORK_ERROR",
    );
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/** Unwraps the `{ data: ... }` envelope or returns the payload directly. Shared with Phase 4. */
export async function requestData<T>(path: string, options?: RequestOptions): Promise<T> {
  const wrapped = await request<Single<T> | T>(path, options);
  if (
    wrapped !== null &&
    typeof wrapped === "object" &&
    "data" in (wrapped as Record<string, unknown>) &&
    (wrapped as Single<T>).data !== undefined
  ) {
    return (wrapped as Single<T>).data;
  }
  return wrapped as T;
}

// ---------- endpoints ----------

export const api = {
  // ---- auth ----
  async login(email: string, password: string): Promise<LoginResponse> {
    const result = await request<LoginResponse>("/api/v1/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
    tokenStore.set(result.access_token);
    return result;
  },

  async logout(): Promise<void> {
    try {
      await request<{ message: string }>("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // A failed logout must still clear the local session.
    } finally {
      tokenStore.clear();
    }
  },

  async me(): Promise<User> {
    return requestData<User>("/api/v1/auth/me");
  },

  // ---- profile ----
  async getProfile(): Promise<Profile> {
    return requestData<Profile>("/api/v1/profile");
  },

  async updateProfile(patch: ProfileUpdate): Promise<Profile> {
    return requestData<Profile>("/api/v1/profile", { method: "PATCH", body: patch });
  },

  // ---- dashboard ----
  async getDashboardSummary(): Promise<DashboardSummary> {
    return requestData<DashboardSummary>("/api/v1/dashboard/summary");
  },

  // ---- customers ----
  async listCustomers(params?: CustomerListParams): Promise<Paginated<Customer>> {
    return request<Paginated<Customer>>("/api/v1/customers", { query: { ...params } });
  },

  async getCustomer(id: string): Promise<Customer> {
    return requestData<Customer>(`/api/v1/customers/${id}`);
  },

  async createCustomer(input: CustomerCreate): Promise<Customer> {
    return requestData<Customer>("/api/v1/customers", { method: "POST", body: input });
  },

  async updateCustomer(id: string, patch: CustomerUpdate): Promise<Customer> {
    return requestData<Customer>(`/api/v1/customers/${id}`, { method: "PATCH", body: patch });
  },

  async deleteCustomer(id: string): Promise<void> {
    await request<void>(`/api/v1/customers/${id}`, { method: "DELETE" });
  },

  // ---- creditors ----
  async listCreditors(params?: CreditorListParams): Promise<Paginated<Creditor>> {
    return request<Paginated<Creditor>>("/api/v1/creditors", { query: { ...params } });
  },

  async getCreditor(id: string): Promise<Creditor> {
    return requestData<Creditor>(`/api/v1/creditors/${id}`);
  },

  async createCreditor(name: string, status = "active"): Promise<Creditor> {
    return requestData<Creditor>("/api/v1/creditors", {
      method: "POST",
      body: { name, status },
    });
  },

  // ---- accounts ----
  async listAccounts(params?: AccountListParams): Promise<Paginated<Account>> {
    return request<Paginated<Account>>("/api/v1/accounts", { query: { ...params } });
  },

  async getAccount(id: string): Promise<Account> {
    return requestData<Account>(`/api/v1/accounts/${id}`);
  },

  async createAccount(input: AccountCreate): Promise<Account> {
    return requestData<Account>("/api/v1/accounts", { method: "POST", body: input });
  },

  async updateAccount(id: string, patch: AccountUpdate): Promise<Account> {
    return requestData<Account>(`/api/v1/accounts/${id}`, { method: "PATCH", body: patch });
  },

  async addPayment(accountId: string, input: PaymentCreate): Promise<AccountPayment> {
    return requestData<AccountPayment>(`/api/v1/accounts/${accountId}/payments`, {
      method: "POST",
      body: input,
    });
  },

  // ---- imports ----
  async listImports(params?: ImportListParams): Promise<Paginated<ImportJob>> {
    return request<Paginated<ImportJob>>("/api/v1/imports", { query: { ...params } });
  },

  async getImport(id: string): Promise<ImportDetail> {
    return requestData<ImportDetail>(`/api/v1/imports/${id}`);
  },

  async uploadImport(file: File): Promise<UploadResult> {
    const formData = new FormData();
    formData.append("file", file);
    return requestData<UploadResult>("/api/v1/imports/upload", {
      method: "POST",
      formData,
    });
  },

  async validateImport(id: string, mapping: ColumnMapping): Promise<ValidateResult> {
    return requestData<ValidateResult>(`/api/v1/imports/${id}/validate`, {
      method: "POST",
      body: { mapping },
    });
  },

  async confirmImport(id: string): Promise<ConfirmImportResult> {
    return requestData<ConfirmImportResult>(`/api/v1/imports/${id}/confirm`, {
      method: "POST",
    });
  },

  // ---- campaigns ----
  async listCampaigns(params?: CampaignListParams): Promise<Paginated<Campaign>> {
    return request<Paginated<Campaign>>("/api/v1/campaigns", { query: { ...params } });
  },

  async listCampaignsV3(
    params?: CampaignListParamsV3,
  ): Promise<Paginated<CampaignWithCounters>> {
    return request<Paginated<CampaignWithCounters>>("/api/v1/campaigns", {
      query: { ...params },
    });
  },

  async getCampaign(id: string): Promise<Campaign> {
    return requestData<Campaign>(`/api/v1/campaigns/${id}`);
  },

  async createCampaign(input: CampaignCreate): Promise<Campaign> {
    return requestData<Campaign>("/api/v1/campaigns", { method: "POST", body: input });
  },

  async updateCampaign(id: string, patch: CampaignUpdate): Promise<Campaign> {
    return requestData<Campaign>(`/api/v1/campaigns/${id}`, { method: "PATCH", body: patch });
  },

  async listCampaignLeads(
    campaignId: string,
    params?: CampaignLeadListParams,
  ): Promise<Paginated<CampaignLead>> {
    return request<Paginated<CampaignLead>>(`/api/v1/campaigns/${campaignId}/leads`, {
      query: { ...params },
    });
  },

  async addCampaignLeads(campaignId: string, accountIds: string[]): Promise<AddLeadsResult> {
    return requestData<AddLeadsResult>(`/api/v1/campaigns/${campaignId}/leads`, {
      method: "POST",
      body: { account_ids: accountIds, priority: 1 },
    });
  },

  // ---- Phase 2: AI Agents ----
  async listAiAgents(page: number = 1, pageSize: number = 25): Promise<Paginated<AiAgent>> {
    return request<Paginated<AiAgent>>("/api/v1/ai-agents", { query: { page, page_size: pageSize } });
  },

  async getAiAgent(id: string): Promise<AiAgent> {
    return requestData<AiAgent>(`/api/v1/ai-agents/${id}`);
  },

  async createAiAgent(input: AiAgentCreate): Promise<AiAgent> {
    return requestData<AiAgent>("/api/v1/ai-agents", { method: "POST", body: input });
  },

  async updateAiAgent(id: string, patch: AiAgentUpdate): Promise<AiAgent> {
    return requestData<AiAgent>(`/api/v1/ai-agents/${id}`, { method: "PATCH", body: patch });
  },

  async uploadVoiceProfile(agentId: string, file: File): Promise<VoiceProfile> {
    const formData = new FormData();
    formData.append("file", file);
    const token = tokenStore.get();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/api/v1/ai-agents/${agentId}/voice`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err?.error?.message ?? "Voice upload failed", res.status, err?.error?.code);
    }
    const json = await res.json();
    return json.data;
  },

  async deleteVoiceProfile(agentId: string): Promise<void> {
    return request<void>(`/api/v1/ai-agents/${agentId}/voice`, { method: "DELETE" });
  },

  async generateVoicePreview(agentId: string, text: string): Promise<VoicePreviewResponse> {
    return requestData<VoicePreviewResponse>(`/api/v1/ai-agents/${agentId}/voice/preview`, {
      method: "POST",
      body: { text },
    });
  },

  // ---- Phase 2: Telephony & AI Status ----
  async getTelephonyStatus(): Promise<TelephonyStatus> {
    return requestData<TelephonyStatus>("/api/v1/telephony/status");
  },

  async listTelephonyGateways(page: number = 1, pageSize: number = 25): Promise<Paginated<TelephonyGateway>> {
    return request<Paginated<TelephonyGateway>>("/api/v1/telephony/gateways", {
      query: { page, page_size: pageSize },
    });
  },

  async createTelephonyGateway(input: TelephonyGatewayCreate): Promise<TelephonyGateway> {
    return requestData<TelephonyGateway>("/api/v1/telephony/gateways", { method: "POST", body: input });
  },

  async getTelephonyGateway(id: string): Promise<TelephonyGateway> {
    return requestData<TelephonyGateway>(`/api/v1/telephony/gateways/${id}`);
  },

  async getAiStatus(): Promise<AiStatusSummary> {
    return requestData<AiStatusSummary>("/api/v1/ai/status");
  },

  // ---- Phase 2: Live Calls & Controls ----
  async listLiveCalls(status?: string, page: number = 1, pageSize: number = 25): Promise<Paginated<LiveCall>> {
    return request<Paginated<LiveCall>>("/api/v1/live-calls", {
      query: { status, page, page_size: pageSize },
    });
  },

  async getLiveCall(id: string): Promise<CallDetail> {
    return requestData<CallDetail>(`/api/v1/live-calls/${id}`);
  },

  async createLiveCall(input: CallCreate): Promise<LiveCall> {
    return requestData<LiveCall>("/api/v1/live-calls", { method: "POST", body: input });
  },

  async muteLiveCall(id: string): Promise<LiveCall> {
    return requestData<LiveCall>(`/api/v1/live-calls/${id}/mute`, { method: "POST" });
  },

  async unmuteLiveCall(id: string): Promise<LiveCall> {
    return requestData<LiveCall>(`/api/v1/live-calls/${id}/unmute`, { method: "POST" });
  },

  async holdLiveCall(id: string): Promise<LiveCall> {
    return requestData<LiveCall>(`/api/v1/live-calls/${id}/hold`, { method: "POST" });
  },

  async resumeLiveCall(id: string): Promise<LiveCall> {
    return requestData<LiveCall>(`/api/v1/live-calls/${id}/resume`, { method: "POST" });
  },

  async transferLiveCall(id: string, payload: CallTransferRequest): Promise<LiveCall> {
    return requestData<LiveCall>(`/api/v1/live-calls/${id}/transfer`, { method: "POST", body: payload });
  },

  async endLiveCall(id: string): Promise<LiveCall> {
    return requestData<LiveCall>(`/api/v1/live-calls/${id}/end`, { method: "POST" });
  },

  async setLiveCallDisposition(id: string, payload: CallDispositionUpdate): Promise<LiveCall> {
    return requestData<LiveCall>(`/api/v1/live-calls/${id}/disposition`, { method: "POST", body: payload });
  },

  async appendLiveCallTranscript(id: string, payload: TranscriptMessageCreate): Promise<TranscriptMessage> {
    return requestData<TranscriptMessage>(`/api/v1/live-calls/${id}/transcript`, {
      method: "POST",
      body: payload,
    });
  },

  // ---- Phase 3: campaign operations ----

  async startCampaign(id: string): Promise<Campaign> {
    return requestData<Campaign>(`/api/v1/campaigns/${id}/start`, { method: "POST" });
  },

  async pauseCampaign(id: string): Promise<Campaign> {
    return requestData<Campaign>(`/api/v1/campaigns/${id}/pause`, { method: "POST" });
  },

  async resumeCampaign(id: string): Promise<Campaign> {
    return requestData<Campaign>(`/api/v1/campaigns/${id}/resume`, { method: "POST" });
  },

  async stopCampaign(id: string): Promise<Campaign> {
    return requestData<Campaign>(`/api/v1/campaigns/${id}/stop`, { method: "POST" });
  },

  async duplicateCampaign(id: string): Promise<Campaign> {
    return requestData<Campaign>(`/api/v1/campaigns/${id}/duplicate`, { method: "POST" });
  },

  async getCampaignMetrics(id: string): Promise<CampaignMetrics> {
    return requestData<CampaignMetrics>(`/api/v1/campaigns/${id}/metrics`);
  },

  async getCampaignDistribution(id: string): Promise<DistributionSet> {
    return requestData<DistributionSet>(`/api/v1/campaigns/${id}/distributions`);
  },

  async getCampaignActivity(
    id: string,
    page: number = 1,
    pageSize: number = 25,
  ): Promise<Paginated<CampaignActivityItem>> {
    return request<Paginated<CampaignActivityItem>>(`/api/v1/campaigns/${id}/activity`, {
      query: { page, page_size: pageSize },
    });
  },

  async previewCampaignLeads(
    filters: CampaignLeadFilterInput,
  ): Promise<LeadPreviewResult> {
    return requestData<LeadPreviewResult>("/api/v1/campaigns/leads/preview", {
      method: "POST",
      body: filters,
    });
  },

  async listCampaignLeadsV3(
    campaignId: string,
    params?: CampaignLeadListParamsV3,
  ): Promise<Paginated<CampaignLeadDetail>> {
    return request<Paginated<CampaignLeadDetail>>(`/api/v1/campaigns/${campaignId}/leads`, {
      query: { ...params },
    });
  },

  async updateCampaignLead(
    campaignId: string,
    leadId: string,
    patch: CampaignLeadUpdate,
  ): Promise<CampaignLeadDetail> {
    return requestData<CampaignLeadDetail>(
      `/api/v1/campaigns/${campaignId}/leads/${leadId}`,
      { method: "PATCH", body: patch },
    );
  },

  async removeCampaignLead(campaignId: string, leadId: string): Promise<void> {
    await request<void>(`/api/v1/campaigns/${campaignId}/leads/${leadId}`, {
      method: "DELETE",
    });
  },

  async bulkCampaignLeadAction(
    campaignId: string,
    action: "add_to_queue" | "remove" | "pause" | "resume",
    leadIds: string[],
  ): Promise<{ updated: number }> {
    return requestData<{ updated: number }>(
      `/api/v1/campaigns/${campaignId}/leads/bulk`,
      { method: "POST", body: { action, lead_ids: leadIds } },
    );
  },

  // ---- Phase 3: recovery queue ----

  async listRecoveryQueue(
    params?: RecoveryQueueListParams,
  ): Promise<Paginated<RecoveryQueueItem>> {
    return request<Paginated<RecoveryQueueItem>>("/api/v1/recovery", { query: { ...params } });
  },

  async recoveryQueueAction(
    action: "pause" | "resume" | "close",
    itemIds: string[],
  ): Promise<{ updated: number }> {
    return requestData<{ updated: number }>("/api/v1/recovery/actions", {
      method: "POST",
      body: { action, item_ids: itemIds },
    });
  },

  // ---- Phase 3: PTP ----

  async listPtp(params?: PtpListParams): Promise<Paginated<PromiseToPay>> {
    return request<Paginated<PromiseToPay>>("/api/v1/ptp", { query: { ...params } });
  },

  async getPtp(id: string): Promise<PromiseToPay> {
    return requestData<PromiseToPay>(`/api/v1/ptp/${id}`);
  },

  async updatePtp(id: string, patch: PtpUpdate): Promise<PromiseToPay> {
    return requestData<PromiseToPay>(`/api/v1/ptp/${id}`, { method: "PATCH", body: patch });
  },

  // ---- Phase 3: callbacks ----

  async listCallbacks(params?: CallbackListParams): Promise<Paginated<Callback>> {
    return request<Paginated<Callback>>("/api/v1/callbacks", { query: { ...params } });
  },

  async getCallback(id: string): Promise<Callback> {
    return requestData<Callback>(`/api/v1/callbacks/${id}`);
  },

  async createCallback(input: CallbackCreate): Promise<Callback> {
    return requestData<Callback>("/api/v1/callbacks", { method: "POST", body: input });
  },

  async updateCallback(id: string, patch: CallbackUpdate): Promise<Callback> {
    return requestData<Callback>(`/api/v1/callbacks/${id}`, { method: "PATCH", body: patch });
  },

  // ---- Phase 3: disputes ----

  async listDisputes(params?: DisputeListParams): Promise<Paginated<Dispute>> {
    return request<Paginated<Dispute>>("/api/v1/disputes", { query: { ...params } });
  },

  async getDispute(id: string): Promise<Dispute> {
    return requestData<Dispute>(`/api/v1/disputes/${id}`);
  },

  async updateDispute(id: string, patch: DisputeUpdate): Promise<Dispute> {
    return requestData<Dispute>(`/api/v1/disputes/${id}`, { method: "PATCH", body: patch });
  },

  // ---- Phase 3: payment intents ----

  async listPaymentIntents(
    params?: PaymentIntentListParams,
  ): Promise<Paginated<PaymentIntent>> {
    return request<Paginated<PaymentIntent>>("/api/v1/payment-intents", {
      query: { ...params },
    });
  },

  async getPaymentIntent(id: string): Promise<PaymentIntent> {
    return requestData<PaymentIntent>(`/api/v1/payment-intents/${id}`);
  },

  async requestPaymentVerification(id: string): Promise<PaymentIntent> {
    return requestData<PaymentIntent>(`/api/v1/payment-intents/${id}/verify`, {
      method: "POST",
    });
  },

  // ---- Phase 3: escalations ----

  async listEscalations(params?: EscalationListParams): Promise<Paginated<Escalation>> {
    return request<Paginated<Escalation>>("/api/v1/escalations", { query: { ...params } });
  },

  async getEscalation(id: string): Promise<Escalation> {
    return requestData<Escalation>(`/api/v1/escalations/${id}`);
  },

  async updateEscalation(id: string, patch: EscalationUpdate): Promise<Escalation> {
    return requestData<Escalation>(`/api/v1/escalations/${id}`, { method: "PATCH", body: patch });
  },

  // ---- Phase 3: follow-ups ----

  async listFollowUps(params?: FollowUpListParams): Promise<Paginated<FollowUp>> {
    return request<Paginated<FollowUp>>("/api/v1/follow-ups", { query: { ...params } });
  },

  async updateFollowUp(id: string, patch: FollowUpUpdate): Promise<FollowUp> {
    return requestData<FollowUp>(`/api/v1/follow-ups/${id}`, { method: "PATCH", body: patch });
  },

  async retryFollowUp(id: string): Promise<FollowUp> {
    return requestData<FollowUp>(`/api/v1/follow-ups/${id}/retry`, { method: "POST" });
  },

  // ---- Phase 3: automation ----

  async listAutomationRules(
    params?: AutomationListParams,
  ): Promise<Paginated<AutomationRule>> {
    return request<Paginated<AutomationRule>>("/api/v1/automation-rules", {
      query: { ...params },
    });
  },

  async getAutomationRule(id: string): Promise<AutomationRule> {
    return requestData<AutomationRule>(`/api/v1/automation-rules/${id}`);
  },

  async createAutomationRule(input: AutomationRuleCreate): Promise<AutomationRule> {
    return requestData<AutomationRule>("/api/v1/automation-rules", {
      method: "POST",
      body: input,
    });
  },

  async updateAutomationRule(
    id: string,
    patch: AutomationRuleUpdate,
  ): Promise<AutomationRule> {
    return requestData<AutomationRule>(`/api/v1/automation-rules/${id}`, {
      method: "PATCH",
      body: patch,
    });
  },

  async deleteAutomationRule(id: string): Promise<void> {
    await request<void>(`/api/v1/automation-rules/${id}`, { method: "DELETE" });
  },

  async listAutomationExecutions(
    page: number = 1,
    pageSize: number = 25,
  ): Promise<Paginated<AutomationExecution>> {
    return request<Paginated<AutomationExecution>>("/api/v1/automation-rules/executions", {
      query: { page, page_size: pageSize },
    });
  },

  // ---- Phase 3: call analysis ----

  async listCallAnalyses(
    params?: CallAnalysisFilterParams,
  ): Promise<Paginated<CallAnalysis>> {
    return request<Paginated<CallAnalysis>>("/api/v1/call-analysis", { query: { ...params } });
  },

  async getCallAnalysis(id: string): Promise<CallAnalysisDetail> {
    return requestData<CallAnalysisDetail>(`/api/v1/call-analysis/${id}`);
  },

  // ---- Phase 3: analytics ----

  async getRecoveryAnalytics(
    query?: RecoveryAnalyticsQuery,
  ): Promise<RecoveryAnalyticsResponse> {
    return requestData<RecoveryAnalyticsResponse>("/api/v1/analytics/recovery", {
      query: { ...query },
    });
  },

  async getCampaignAnalytics(
    id: string,
    query?: RecoveryAnalyticsQuery,
  ): Promise<RecoveryAnalyticsResponse> {
    return requestData<RecoveryAnalyticsResponse>(`/api/v1/campaigns/${id}/analytics`, {
      query: { ...query },
    });
  },

  // ---- Phase 3: exports ----

  async listExports(params?: ExportListParams): Promise<Paginated<ExportJob>> {
    return request<Paginated<ExportJob>>("/api/v1/exports", { query: { ...params } });
  },

  async previewExport(body: ExportCreate): Promise<ExportPreview> {
    return requestData<ExportPreview>("/api/v1/exports/preview", { method: "POST", body });
  },

  async createExport(body: ExportCreate): Promise<ExportJob> {
    return requestData<ExportJob>("/api/v1/exports", { method: "POST", body });
  },

  /** Streams the generated file; the browser handles the download. */
  async downloadExport(id: string): Promise<void> {
    const token = tokenStore.get();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}/api/v1/exports/${id}/download`, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    if (!response.ok) {
      throw await toApiError(response);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = response.headers.get("content-disposition")?.match(/filename="?([^";]+)"?/)?.[1] ?? `export-${id}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },

  // ---- users (escalation assignment etc.) ----

  async listUsers(page: number = 1, pageSize: number = 100): Promise<Paginated<User>> {
    return request<Paginated<User>>("/api/v1/users", { query: { page, page_size: pageSize } });
  },

  // ---- health ----
  async health(): Promise<{ status: string; version: string }> {
    return request<{ status: string; version: string }>("/health", { auth: false });
  },
};

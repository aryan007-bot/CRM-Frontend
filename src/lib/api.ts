/**
 * Typed API client shaped like the future FastAPI backend.
 *
 * Every method maps 1:1 to a planned REST endpoint:
 *   GET    /api/v1/campaigns
 *   POST   /api/v1/campaigns
 *   PATCH  /api/v1/campaigns/:id
 *   DELETE /api/v1/campaigns/:id
 *   GET    /api/v1/contacts
 *   GET    /api/v1/contacts/:id
 *   PATCH  /api/v1/contacts/:id
 *   GET    /api/v1/calls
 *   GET    /api/v1/calls/:id
 *   GET    /api/v1/live
 *   POST   /api/v1/live/:id/takeover
 *   GET    /api/v1/settings
 *   PUT    /api/v1/settings
 *   GET    /api/v1/dashboard
 *
 * When the FastAPI backend lands, replace the internals of each method
 * with `fetch` calls — method signatures and UI code stay identical.
 */

import type {
  Call,
  CallOutcome,
  Campaign,
  Contact,
  ContactStatus,
  DashboardStats,
  LiveCall,
  OrgSettings,
  Paginated,
} from "./types";
import {
  calls as mockCalls,
  campaigns as mockCampaigns,
  contacts as mockContacts,
  dashboardStats,
  defaultSettings,
  liveCalls as mockLiveCalls,
} from "./mock-data";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Simulated network latency so loading states are exercised realistically. */
function latency(ms = 120): Promise<void> {
  return new Promise((r) => setTimeout(r, ms + Math.random() * 180));
}

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

// In-memory store — mutations persist for the session.
const store = {
  campaigns: deepClone(mockCampaigns),
  contacts: deepClone(mockContacts),
  calls: deepClone(mockCalls),
  settings: deepClone(defaultSettings),
};

function nextId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}`;
}

export const api = {
  // ---------- campaigns ----------

  async listCampaigns(): Promise<Campaign[]> {
    await latency();
    return deepClone(store.campaigns).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  },

  async createCampaign(
    input: Omit<Campaign, "id" | "createdAt" | "updatedAt" | "createdBy" | "contactIds">,
  ): Promise<Campaign> {
    await latency(200);
    const now = new Date().toISOString();
    const campaign: Campaign = {
      ...input,
      id: nextId("cmp"),
      contactIds: [],
      createdBy: "you",
      createdAt: now,
      updatedAt: now,
    };
    store.campaigns.unshift(campaign);
    return deepClone(campaign);
  },

  async updateCampaign(id: string, patch: Partial<Campaign>): Promise<Campaign> {
    await latency(150);
    const idx = store.campaigns.findIndex((c) => c.id === id);
    if (idx === -1) throw new ApiError("Campaign not found", 404);
    store.campaigns[idx] = {
      ...store.campaigns[idx],
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    };
    return deepClone(store.campaigns[idx]);
  },

  async deleteCampaign(id: string): Promise<void> {
    await latency(150);
    const idx = store.campaigns.findIndex((c) => c.id === id);
    if (idx === -1) throw new ApiError("Campaign not found", 404);
    if (store.campaigns[idx].status === "active") {
      throw new ApiError("Pause the campaign before deleting it", 409);
    }
    store.campaigns.splice(idx, 1);
  },

  // ---------- contacts ----------

  async listContacts(params?: {
    search?: string;
    status?: ContactStatus | "all";
    page?: number;
    pageSize?: number;
  }): Promise<Paginated<Contact>> {
    await latency();
    const search = params?.search?.trim().toLowerCase() ?? "";
    const pageSize = params?.pageSize ?? 10;
    const page = params?.page ?? 1;

    let items = deepClone(store.contacts);
    if (params?.status && params.status !== "all") {
      items = items.filter((c) => c.status === params.status);
    }
    if (search) {
      items = items.filter((c) =>
        [c.firstName, c.lastName, c.accountRef, c.phone]
          .join(" ")
          .toLowerCase()
          .includes(search),
      );
    }
    items.sort((a, b) => a.lastName.localeCompare(b.lastName));
    const total = items.length;
    return {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      total,
    };
  },

  async getContact(id: string): Promise<Contact> {
    await latency(80);
    const contact = store.contacts.find((c) => c.id === id);
    if (!contact) throw new ApiError("Contact not found", 404);
    return deepClone(contact);
  },

  async updateContact(id: string, patch: Partial<Contact>): Promise<Contact> {
    await latency(120);
    const idx = store.contacts.findIndex((c) => c.id === id);
    if (idx === -1) throw new ApiError("Contact not found", 404);
    store.contacts[idx] = { ...store.contacts[idx], ...patch, id };
    return deepClone(store.contacts[idx]);
  },

  // ---------- calls ----------

  async listCalls(params?: {
    outcome?: CallOutcome | "all";
    campaignId?: string | "all";
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<Paginated<Call>> {
    await latency();
    const search = params?.search?.trim().toLowerCase() ?? "";
    const pageSize = params?.pageSize ?? 10;
    const page = params?.page ?? 1;

    let items = deepClone(store.calls);
    if (params?.outcome && params.outcome !== "all") {
      items = items.filter((c) => c.outcome === params.outcome);
    }
    if (params?.campaignId && params.campaignId !== "all") {
      items = items.filter((c) => c.campaignId === params.campaignId);
    }
    if (search) {
      items = items.filter((c) => c.id.toLowerCase().includes(search));
    }
    const total = items.length;
    return {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      total,
    };
  },

  async getCall(id: string): Promise<Call> {
    await latency(80);
    const call = store.calls.find((c) => c.id === id);
    if (!call) throw new ApiError("Call not found", 404);
    return deepClone(call);
  },

  /** id → display-name lookups for rendering call rows. */
  async getNameMaps(): Promise<{
    contacts: Record<string, string>;
    campaigns: Record<string, string>;
  }> {
    await latency(80);
    const contacts: Record<string, string> = {};
    for (const c of store.contacts) contacts[c.id] = `${c.firstName} ${c.lastName}`;
    const campaigns: Record<string, string> = {};
    for (const c of store.campaigns) campaigns[c.id] = c.name;
    return { contacts, campaigns };
  },

  // ---------- live console ----------

  async listLiveCalls(): Promise<LiveCall[]> {
    await latency(200);
    return mockLiveCalls();
  },

  async takeoverLiveCall(): Promise<{ ok: true }> {
    // POST /api/v1/live/:id/takeover once the backend exists.
    await latency(150);
    return { ok: true };
  },

  // ---------- settings ----------

  async getSettings(): Promise<OrgSettings> {
    await latency();
    return deepClone(store.settings);
  },

  async updateSettings(patch: OrgSettings): Promise<OrgSettings> {
    await latency(200);
    store.settings = deepClone(patch);
    return deepClone(store.settings);
  },

  // ---------- dashboard ----------

  async getDashboard(): Promise<DashboardStats> {
    await latency(200);
    return dashboardStats();
  },
};

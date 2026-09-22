/**
 * Synthetic, deterministic demo data. No real PII — every record is fake.
 * Generated with a fixed PRNG seed so numbers stay stable across reloads.
 */

import type {
  Call,
  CallOutcome,
  Campaign,
  CampaignStats,
  Contact,
  DashboardStats,
  DialMode,
  LiveCall,
  LiveCallState,
  OrgSettings,
  Sentiment,
} from "./types";

// ---------- deterministic PRNG ----------

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260922);

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)] as T;
}

function int(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

// ---------- reference data ----------

const FIRST_NAMES = [
  "James", "Maria", "Robert", "Linda", "Michael", "Patricia", "David",
  "Jennifer", "William", "Elena", "Richard", "Susan", "Joseph", "Karen",
  "Thomas", "Nancy", "Carlos", "Lisa", "Marcus", "Sandra", "Andre", "Priya",
  "Daniel", "Olivia", "Kevin", "Diana", "Brian", "Rosa", "Tyler", "Aisha",
] as const;

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
  "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Wilson",
  "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee",
  "Perez", "Thompson", "White", "Patel", "Nguyen", "Rivera", "Carter",
] as const;

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
] as const;

const OUTCOMES = [
  "ai_resolved",
  "promise_to_pay",
  "human_takeover",
  "callback_scheduled",
  "no_answer",
  "voicemail",
  "busy",
  "failed",
] as const satisfies readonly CallOutcome[];

const SENTIMENTS = ["positive", "neutral", "negative"] as const;

// ---------- campaigns ----------

const CAMPAIGN_SEEDS: Array<{
  name: string;
  description: string;
  status: Campaign["status"];
  dialMode: DialMode;
  concurrency: number;
}> = [
  {
    name: "Q3 Auto Loan Recovery",
    description: "Delinquent auto loan accounts 30–90 days past due.",
    status: "active",
    dialMode: "predictive",
    concurrency: 40,
  },
  {
    name: "Credit Card Early Delinquency",
    description: "First-touch outreach for cards 15–45 days past due.",
    status: "active",
    dialMode: "progressive",
    concurrency: 25,
  },
  {
    name: "Medical Balance Follow-up",
    description: "Hospital payment-plan reminders, post-discharge 60+ days.",
    status: "paused",
    dialMode: "preview",
    concurrency: 10,
  },
  {
    name: "Utilities Final Notice",
    description: "Final-notice utility accounts before service suspension.",
    status: "active",
    dialMode: "progressive",
    concurrency: 18,
  },
  {
    name: "Personal Loan Win-back",
    description: "Settlement offers for charged-off personal loans.",
    status: "draft",
    dialMode: "preview",
    concurrency: 8,
  },
  {
    name: "Spring Card Sweep (Archive)",
    description: "Completed spring quarter card outreach.",
    status: "completed",
    dialMode: "predictive",
    concurrency: 30,
  },
];

const DAYS = ["mon", "tue", "wed", "thu", "fri"] as const;

export const campaigns: Campaign[] = CAMPAIGN_SEEDS.map((seed, i) => {
  const startHour = pick([8, 9]);
  const days = i % 2 === 0 ? [...DAYS, "sat" as const] : [...DAYS];
  return {
    id: `cmp_${String(i + 1).padStart(3, "0")}`,
    name: seed.name,
    description: seed.description,
    status: seed.status,
    dialMode: seed.dialMode,
    concurrency: seed.concurrency,
    maxAttempts: pick([3, 4, 5]),
    schedule: {
      days,
      startHour,
      endHour: startHour + 9,
      timezone: "America/New_York",
    },
    contactIds: [],
    createdBy: pick(["s.reyes", "t.okafor", "m.laurent", "j.chen"]),
    createdAt: new Date(Date.now() - int(30, 180) * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - int(0, 14) * 86_400_000).toISOString(),
  };
});

// ---------- contacts ----------

export const contacts: Contact[] = Array.from({ length: 48 }, (_, i) => {
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);
  const status = pick<Contact["status"]>([
    "new", "new", "in_progress", "in_progress", "promised_to_pay",
    "payment_arranged", "callback", "disputed", "do_not_call", "closed",
  ]);
  const attempts = int(0, 6);
  return {
    id: `cnt_${String(i + 1).padStart(3, "0")}`,
    accountRef: `ACCT-${int(10000, 99999)}`,
    firstName,
    lastName,
    phone: `+1 ${int(201, 989)}-${int(200, 999)}-${int(1000, 9999)}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
    status,
    balanceDue: int(1, 120) * 50,
    debtAgeDays: int(10, 240),
    timezone: pick(TIMEZONES),
    attempts,
    lastContactedAt:
      attempts === 0
        ? null
        : new Date(Date.now() - int(0, 30) * 86_400_000 - int(0, 86_400_000)).toISOString(),
    tcpaConsent: rand() > 0.12,
    fdcpaEligible: rand() > 0.05,
    notes: pick([
      "Prefers evening calls.",
      "Asked about hardship program — send form.",
      "Disputed last statement amount.",
      "Wants communication by email only.",
      "",
      "Recently switched jobs; expects payroll resume next month.",
      "Language preference: Spanish.",
      "",
    ]),
  };
});

// assign contacts round-robin to the four non-draft campaigns
const dialableCampaigns = campaigns.filter(
  (c) => c.status !== "draft",
);
contacts.forEach((c, i) => {
  const campaign = dialableCampaigns[i % dialableCampaigns.length];
  if (campaign) campaign.contactIds.push(c.id);
});

// ---------- calls ----------

const AI_OPENERS = [
  "Hi, this is Ava calling on behalf of Meridian Recovery. Am I speaking with",
  "Good afternoon, this is Ava from Meridian Recovery regarding a personal matter. Is this",
  "Hello, my name is Ava, and I'm calling about an important account matter. May I speak with",
];

const AI_DISCLOSURE =
  "This call may be recorded for quality and compliance purposes. Per the Fair Debt Collection Practices Act, this is an attempt to collect a debt.";

const CONTACT_RESPONSES = [
  "Yes, this is them. What is this about?",
  "Speaking. Who is calling?",
  "Yeah, that's me.",
  "This is — I was wondering when someone would call.",
];

const AI_BALANCE_LINES = [
  "Thank you. Our records show a balance of",
  "I understand. The outstanding balance on the account is currently",
  "I can help with that. The account shows a remaining balance of",
];

const CONTACT_CLOSERS = [
  "I can set up a payment this Friday when I get paid.",
  "I'm not sure I can pay the full amount right now.",
  "Can you send me the details by email first?",
  "I already disputed this charge last month.",
  "Let me call you back tomorrow after I check my finances.",
];

const AI_CLOSERS = [
  "Understood — I've scheduled that for you and sent a confirmation. Thank you for your time today.",
  "That's completely understandable. I've noted your preference and a specialist will follow up.",
  "Of course. I'm transferring you to a specialist who can go over the details with you.",
];

function buildTranscript(contact: Contact, connected: boolean) {
  if (!connected) return [];
  const turns = [
    { speaker: "ai" as const, atSec: 2, text: pick(AI_OPENERS) },
    { speaker: "contact" as const, atSec: 7, text: pick(CONTACT_RESPONSES) },
    { speaker: "ai" as const, atSec: 12, text: `${AI_DISCLOSURE} ${pick(AI_BALANCE_LINES)}` },
    { speaker: "contact" as const, atSec: 24, text: pick(CONTACT_CLOSERS) },
    { speaker: "ai" as const, atSec: 36, text: pick(AI_CLOSERS) },
  ];
  const balance = `${contact.balanceDue.toLocaleString()} dollars.`;
  return turns.map((t) =>
    t.speaker === "ai" && t.text.includes("balance of")
      ? { ...t, text: `${t.text} ${balance}` }
      : t,
  );
}

export const calls: Call[] = Array.from({ length: 90 }, (_, i) => {
  const contact = pick(contacts);
  const campaign = dialableCampaigns.find((c) =>
    c.contactIds.includes(contact.id),
  ) ?? dialableCampaigns[0];
  const notConnected = ["no_answer", "voicemail", "busy", "failed"];
  const outcome = pick<CallOutcome>([
    "ai_resolved", "ai_resolved", "promise_to_pay", "promise_to_pay",
    "human_takeover", "callback_scheduled", "no_answer", "no_answer",
    "voicemail", "busy", "failed",
  ]);
  const connected = !notConnected.includes(outcome);
  const startedAt = new Date(
    Date.now() - int(0, 13) * 86_400_000 - int(8, 19) * 3_600_000 - int(0, 3_599) * 1_000,
  ).toISOString();
  return {
    id: `call_${String(i + 1).padStart(4, "0")}`,
    campaignId: campaign?.id ?? campaigns[0].id,
    contactId: contact.id,
    startedAt,
    durationSec: connected ? int(35, 420) : pick([0, 5, 12, 18]),
    outcome,
    sentiment: connected
      ? pick<Sentiment>(["positive", "neutral", "neutral", "negative"])
      : "neutral",
    aiSummary: connected
      ? pick([
          "Contact acknowledged the balance and agreed to a payment arrangement.",
          "Contact requested callback after reviewing finances; follow-up scheduled.",
          "Contact disputed the amount; escalated to a human specialist per policy.",
          "Contact requested email communication; compliance note added.",
          "Payment link sent; contact confirmed Friday payment date.",
        ])
      : "No conversation — line did not connect.",
    transcript: buildTranscript(contact, connected),
  };
}).sort((a, b) => b.startedAt.localeCompare(a.startedAt));

// ---------- campaign stats ----------

export function campaignStats(campaignId: string): CampaignStats {
  const campaignCalls = calls.filter((c) => c.campaignId === campaignId);
  const connected = campaignCalls.filter(
    (c) => !["no_answer", "voicemail", "busy", "failed"].includes(c.outcome),
  );
  return {
    queued: int(5, 120),
    callsToday: campaignCalls.filter(
      (c) => Date.now() - new Date(c.startedAt).getTime() < 86_400_000,
    ).length,
    connectRate: campaignCalls.length ? connected.length / campaignCalls.length : 0,
    aiResolutionRate: connected.length
      ? connected.filter((c) => c.outcome === "ai_resolved").length / connected.length
      : 0,
    promiseRate: connected.length
      ? connected.filter((c) => c.outcome === "promise_to_pay").length / connected.length
      : 0,
  };
}

// ---------- live calls ----------

const LIVE_AGENTS = ["Ava (AI)", "Ava (AI)", "Ava (AI)", "T. Okafor", "S. Reyes"];

export function liveCalls(): LiveCall[] {
  const count = int(5, 8);
  const states: LiveCallState[] = [
    "dialing", "talking", "talking", "talking", "hold", "transferring", "wrap_up",
  ];
  return Array.from({ length: count }, (_, i) => {
    const contact = pick(contacts);
    const campaign = dialableCampaigns.find((c) => c.contactIds.includes(contact.id));
    return {
      id: `live_${i + 1}`,
      campaignId: campaign?.id ?? campaigns[0].id,
      contactId: contact.id,
      state: pick(states),
      elapsedSec: int(3, 400),
      sentiment: pick(SENTIMENTS),
      aiConfidence: Math.round(rand() * 100) / 100,
      agent: pick(LIVE_AGENTS),
    };
  });
}

// ---------- settings ----------

export const defaultSettings: OrgSettings = {
  businessName: "Meridian Recovery Partners",
  timezone: "America/New_York",
  dialingDays: ["mon", "tue", "wed", "thu", "fri"],
  dialingStartHour: 8,
  dialingEndHour: 20,
  ai: {
    personaName: "Ava",
    voiceModel: "aurora-voice-v3",
    speechRate: 1.0,
    empathyLevel: "balanced",
    greetingScript:
      "Hi, this is {{agent}} calling from {{company}} regarding a personal matter. Am I speaking with {{contact_first_name}}?",
    escalationToHuman: true,
  },
  compliance: {
    quietHours: { startHour: 21, endHour: 8 },
    maxAttemptsPerDay: 3,
    minDaysBetweenAttempts: 2,
    recordingDisclosure: true,
    honorDncList: true,
    autoPurgeDays: 2555,
  },
};

// ---------- dashboard ----------

export function dashboardStats(): DashboardStats {
  const connected = calls.filter(
    (c) => !["no_answer", "voicemail", "busy", "failed"].includes(c.outcome),
  );
  const today = calls.filter(
    (c) => Date.now() - new Date(c.startedAt).getTime() < 86_400_000,
  );

  const hourly = Array.from({ length: 12 }, (_, i) => {
    const hour = 8 + i;
    return {
      hour: `${((hour + 11) % 12) + 1}${hour < 12 ? "am" : "pm"}`,
      calls: int(4, 30),
      connected: int(2, 20),
    };
  });

  const daily = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86_400_000);
    return {
      date: d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" }),
      calls: int(40, 120),
      connected: int(20, 80),
    };
  });

  const outcomeCounts = OUTCOMES.map((outcome) => ({
    outcome,
    count: calls.filter((c) => c.outcome === outcome).length,
  })).filter((o) => o.count > 0);

  return {
    kpis: {
      activeCampaigns: campaigns.filter((c) => c.status === "active").length,
      callsToday: today.length || 42,
      connectRate: calls.length ? connected.length / calls.length : 0,
      aiResolutionRate: connected.length
        ? connected.filter((c) => c.outcome === "ai_resolved").length / connected.length
        : 0,
      promisedToday: today.filter((c) => c.outcome === "promise_to_pay").length || 7,
      promisedAmount: int(4, 18) * 500,
    },
    hourly,
    outcomes: outcomeCounts,
    daily,
    recentCalls: calls.slice(0, 8),
  };
}

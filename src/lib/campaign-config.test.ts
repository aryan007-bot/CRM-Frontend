import { describe, expect, it } from "vitest";
import {
  DEFAULT_WIZARD_CONFIG,
  campaignWizardSchema,
  dialingSchema,
  toCampaignCreate,
} from "./campaign-config";

describe("campaign wizard schema", () => {
  it("accepts a completed configuration based on the defaults", () => {
    const config = structuredClone(DEFAULT_WIZARD_CONFIG);
    config.details.name = "Q3 overdue card recovery";
    config.details.creditor_id = "550e8400-e29b-41d4-a716-446655440000";
    config.strategy.agent_id = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    const result = campaignWizardSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("still accepts a configuration without creditor or agent (fresh orgs)", () => {
    const config = structuredClone(DEFAULT_WIZARD_CONFIG);
    config.details.name = "Minimal campaign";
    const result = campaignWizardSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("keeps the untouched default invalid so submit stays disabled", () => {
    // The wizard ships with a blank name/creditor/agent on purpose — the
    // review step must not be submittable before the operator fills them in.
    expect(campaignWizardSchema.safeParse(DEFAULT_WIZARD_CONFIG).success).toBe(false);
  });

  it("rejects a name that is too short", () => {
    const config = structuredClone(DEFAULT_WIZARD_CONFIG);
    config.details.name = "ab";
    const result = campaignWizardSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("rejects a calling window that ends before it starts", () => {
    const config = structuredClone(DEFAULT_WIZARD_CONFIG);
    config.dialing.calling_start_time = "19:00";
    config.dialing.calling_end_time = "09:00";
    const result = campaignWizardSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("calling_end_time"))).toBe(
        true,
      );
    }
  });

  it("rejects disabling DNC enforcement (policy guard)", () => {
    const config = structuredClone(DEFAULT_WIZARD_CONFIG);
    config.dialing.enforce_dnc = false;
    const result = campaignWizardSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("rejects retry delays below the 15-minute policy floor", () => {
    const result = dialingSchema.safeParse({
      ...structuredClone(DEFAULT_WIZARD_CONFIG.dialing),
      retry_delay_minutes: 5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid decimal amounts in lead filters", () => {
    const config = structuredClone(DEFAULT_WIZARD_CONFIG);
    config.leadSource.filters.min_outstanding = "12,000"; // commas not allowed
    const result = campaignWizardSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("maps the wizard config onto the CampaignCreate contract", () => {
    const campaign = toCampaignCreate({
      ...structuredClone(DEFAULT_WIZARD_CONFIG),
      details: {
        ...structuredClone(DEFAULT_WIZARD_CONFIG.details),
        name: "Q3 recovery",
        description: "Test campaign",
      },
    });

    expect(campaign.name).toBe("Q3 recovery");
    expect(campaign.calling_start_time).toBe("09:00:00");
    expect(campaign.calling_end_time).toBe("19:00:00");
    expect(campaign.max_attempts).toBe(3);
    expect(campaign.retry_delay_minutes).toBe(240);
  });
});

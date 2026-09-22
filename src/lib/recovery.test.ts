import { describe, expect, it } from "vitest";
import {
  AUTOMATION_ACTION_LABELS,
  AUTOMATION_TRIGGER_LABELS,
  campaignStatusMeta,
  callbackMeta,
  disputeMeta,
  escalationMeta,
  followUpMeta,
  outcomeMeta,
  paymentIntentMeta,
  ptpMeta,
  queueMeta,
} from "./recovery";

describe("outcome meta", () => {
  it("resolves every documented Phase 3 outcome with a label and hint", () => {
    const outcomes = [
      "PAID",
      "PROMISE_TO_PAY",
      "PAYMENT_INTENT",
      "CALLBACK",
      "ALREADY_PAID",
      "DISPUTE",
      "WRONG_NUMBER",
      "WRONG_PERSON",
      "REFUSED",
      "HARDSHIP",
      "NO_ANSWER",
      "BUSY",
      "FAILED",
      "TRANSFERRED",
      "ESCALATED",
    ];

    for (const outcome of outcomes) {
      const meta = outcomeMeta(outcome);
      expect(meta.label).not.toBe("—");
      expect(meta.hint.length).toBeGreaterThan(0);
      expect(meta.tone).toBeDefined();
    }
  });

  it("is case-insensitive and tolerates wire-format casing", () => {
    expect(outcomeMeta("promise_to_pay").label).toBe("Promise to pay");
    expect(outcomeMeta("Paid").label).toBe("Paid");
  });

  it("falls back to a neutral badge for unknown values", () => {
    const meta = outcomeMeta("SOMETHING_NEW");
    expect(meta.label).toBe("Something new");
    expect(meta.tone).toBe("neutral");
  });

  it("renders an em-dash placeholder for empty values", () => {
    expect(outcomeMeta(null).label).toBe("—");
    expect(outcomeMeta(undefined).label).toBe("—");
  });
});

describe("status meta families", () => {
  it("covers all PTP statuses", () => {
    for (const status of ["PENDING", "CONFIRMED", "DUE", "PAID", "BROKEN", "CANCELLED"]) {
      expect(ptpMeta(status).label).not.toBe("—");
    }
  });

  it("covers all callback statuses", () => {
    for (const status of ["SCHEDULED", "DUE", "IN_PROGRESS", "COMPLETED", "MISSED", "CANCELLED"]) {
      expect(callbackMeta(status).label).not.toBe("—");
    }
  });

  it("covers all dispute statuses", () => {
    for (const status of ["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED", "ESCALATED"]) {
      expect(disputeMeta(status).label).not.toBe("—");
    }
  });

  it("covers all escalation statuses", () => {
    for (const status of ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]) {
      expect(escalationMeta(status).label).not.toBe("—");
    }
  });

  it("covers all follow-up statuses", () => {
    for (const status of ["SCHEDULED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED", "SKIPPED"]) {
      expect(followUpMeta(status).label).not.toBe("—");
    }
  });

  it("covers all queue statuses", () => {
    for (const status of [
      "PENDING",
      "READY",
      "IN_PROGRESS",
      "CALLBACK",
      "FOLLOW_UP",
      "PAUSED",
      "COMPLETED",
      "ESCALATED",
      "CLOSED",
    ]) {
      expect(queueMeta(status).label).not.toBe("—");
    }
  });

  it("covers all Phase 3 campaign statuses", () => {
    for (const status of ["DRAFT", "READY", "RUNNING", "PAUSED", "COMPLETED", "STOPPED", "FAILED"]) {
      expect(campaignStatusMeta(status).label).not.toBe("—");
    }
  });

  it("covers all payment intent states", () => {
    for (const intent of [
      "UNKNOWN",
      "NO_INTENT",
      "PARTIAL_PAYMENT",
      "FULL_PAYMENT",
      "PROMISE_TO_PAY",
      "ALREADY_PAID",
      "PAYMENT_PENDING_VERIFICATION",
    ]) {
      expect(paymentIntentMeta(intent).label).not.toBe("—");
    }
  });
});

describe("automation label maps", () => {
  it("labels every trigger used by the follow-up rule builder", () => {
    for (const trigger of [
      "NO_ANSWER",
      "BUSY",
      "FAILED",
      "CALLBACK",
      "PTP_CREATED",
      "PTP_DUE",
      "PTP_BROKEN",
      "DISPUTE",
      "REFUSAL",
      "HARDSHIP",
      "ALREADY_PAID",
      "WRONG_NUMBER",
      "ESCALATION_CREATED",
    ]) {
      expect(AUTOMATION_TRIGGER_LABELS[trigger]).toBeTruthy();
    }
  });

  it("labels every action available in the rule builder", () => {
    for (const action of [
      "SCHEDULE_RETRY",
      "SCHEDULE_CALLBACK",
      "CREATE_FOLLOW_UP",
      "CREATE_ESCALATION",
      "REQUEST_PAYMENT_VERIFICATION",
      "CLOSE_LEAD",
    ]) {
      expect(AUTOMATION_ACTION_LABELS[action]).toBeTruthy();
    }
  });
});

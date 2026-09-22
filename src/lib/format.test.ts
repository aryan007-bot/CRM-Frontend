import { describe, expect, it } from "vitest";
import {
  formatCount,
  formatDate,
  formatMoney,
  humanize,
  initials,
  statusToken,
  sumMoney,
} from "./format";

describe("formatMoney", () => {
  it("formats exact decimal strings without float artefacts", () => {
    expect(formatMoney("45000.00")).toBe("₹45,000.00");
    expect(formatMoney("150000.75")).toBe("₹1,50,000.75");
    expect(formatMoney("0.00")).toBe("₹0.00");
    expect(formatMoney("0.10")).toBe("₹0.10");
    // Indian grouping: 9,99,99,99,99,999 (matches Intl en-IN).
    expect(formatMoney("999999999999.99")).toBe("₹9,99,99,99,99,999.99");
  });

  it("never loses precision on values a float cannot hold", () => {
    // 0.1 + 0.2 style drift would show up here.
    expect(formatMoney("0.30")).toBe("₹0.30");
    // Beyond Number.MAX_SAFE_INTEGER: still exact because it is string maths.
    expect(formatMoney("9007199254740993.01")).toBe("₹9,00,71,99,25,47,40,993.01");
  });

  it("pads or truncates the fraction to two digits", () => {
    expect(formatMoney("250")).toBe("₹250.00");
    expect(formatMoney("250.5")).toBe("₹250.50");
    expect(formatMoney("250.567")).toBe("₹250.56");
  });

  it("handles negative values and other currencies", () => {
    expect(formatMoney("-1500.25")).toBe("-₹1,500.25");
    expect(formatMoney("1234.50", "USD")).toBe("$1,234.50");
    expect(formatMoney("1234.50", "AUD")).toBe("AUD 1,234.50");
  });

  it("returns a placeholder for missing values and rejects garbage", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
    expect(formatMoney("")).toBe("—");
    expect(formatMoney("not-a-number")).toBe("not-a-number");
  });
});

describe("sumMoney", () => {
  it("adds decimal strings exactly", () => {
    expect(sumMoney(["0.10", "0.20"])).toBe("0.30");
    expect(sumMoney(["25000.50", "10000.00", "4999.50"])).toBe("40000.00");
    expect(sumMoney(["9007199254740993.01", "0.01"])).toBe("9007199254740993.02");
  });

  it("ignores missing values and handles negatives", () => {
    expect(sumMoney([])).toBe("0.00");
    expect(sumMoney([null, undefined, "5.00"])).toBe("5.00");
    expect(sumMoney(["100.00", "-30.50"])).toBe("69.50");
    expect(sumMoney(["-1.00", "-2.25"])).toBe("-3.25");
  });
});

describe("formatCount", () => {
  it("groups digits and handles missing values", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(1500)).toBe("1,500");
    expect(formatCount(1234567)).toBe("12,34,567");
    expect(formatCount(null)).toBe("—");
  });
});

describe("formatDate", () => {
  it("formats date-only strings without timezone drift", () => {
    expect(formatDate("2026-10-15")).toBe("15 Oct 2026");
    expect(formatDate("2026-01-01")).toBe("01 Jan 2026");
  });

  it("handles missing and unparseable values", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("nonsense")).toBe("nonsense");
  });
});

describe("humanize", () => {
  it("converts API enum values to labels", () => {
    expect(humanize("partially_completed")).toBe("Partially completed");
    expect(humanize("on_hold")).toBe("On hold");
    expect(humanize("active")).toBe("Active");
    expect(humanize(null)).toBe("—");
  });
});

describe("initials", () => {
  it("derives avatar initials from a name", () => {
    expect(initials("Rajesh Sharma")).toBe("RS");
    expect(initials("Meera")).toBe("ME");
    expect(initials("  ")).toBe("?");
  });
});

describe("statusToken", () => {
  it("maps statuses to css-safe tokens", () => {
    expect(statusToken("on_hold")).toBe("on-hold");
    expect(statusToken("partially_completed")).toBe("partially-completed");
    expect(statusToken(null)).toBe("unknown");
  });
});

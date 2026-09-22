import { describe, expect, it } from "vitest";
import {
  buildQueryString,
  getOptionalNumber,
  getPositiveInt,
  getString,
  toSearchParams,
} from "./query-state";

describe("toSearchParams", () => {
  it("drops empty values and stringifies the rest", () => {
    expect(
      toSearchParams({
        status: "RUNNING",
        creditor: "",
        page: 2,
        flag: true,
        blank: null,
        missing: undefined,
      }),
    ).toEqual({ status: "RUNNING", page: "2", flag: "true" });
  });
});

describe("buildQueryString", () => {
  it("produces a query string without empty params", () => {
    expect(buildQueryString({ status: "RUNNING", page: 3, search: "" })).toBe(
      "?status=RUNNING&page=3",
    );
  });

  it("returns an empty string when nothing is set", () => {
    expect(buildQueryString({})).toBe("");
    expect(buildQueryString({ status: null })).toBe("");
  });
});

describe("readers", () => {
  function makeParams(query: string): URLSearchParams {
    return new URLSearchParams(query);
  }

  it("getString falls back when missing or empty", () => {
    expect(getString(makeParams("?search=abc"), "search")).toBe("abc");
    expect(getString(makeParams(""), "search", "fallback")).toBe("fallback");
    expect(getString(makeParams("?search="), "search", "fallback")).toBe("fallback");
  });

  it("getPositiveInt rejects invalid pages", () => {
    expect(getPositiveInt(makeParams("?page=4"), "page", 1)).toBe(4);
    expect(getPositiveInt(makeParams("?page=0"), "page", 1)).toBe(1);
    expect(getPositiveInt(makeParams("?page=-3"), "page", 1)).toBe(1);
    expect(getPositiveInt(makeParams("?page=abc"), "page", 1)).toBe(1);
  });

  it("getOptionalNumber parses amounts and rejects junk", () => {
    expect(getOptionalNumber(makeParams("?min=1500.50"), "min")).toBe(1500.5);
    expect(getOptionalNumber(makeParams("?min="), "min")).toBeUndefined();
    expect(getOptionalNumber(makeParams("?min=NaN"), "min")).toBeUndefined();
  });
});

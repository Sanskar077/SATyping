import { describe, it, expect } from "vitest";
import { parseBoolQueryParam, normalizeBoolQueryParams } from "../lib/query-params";

/**
 * Guards the ?flag=false regression: zod.coerce.boolean() is Boolean(value), so the query string
 * "false" coerced to TRUE — /api/plans?forInstitute=false returned institute plans, hiding every
 * student plan from the plans page. Booleans must go through this explicit parser instead.
 */
describe("parseBoolQueryParam", () => {
  it('parses "false" as false — THE bug this module exists for', () => {
    expect(parseBoolQueryParam("false")).toBe(false);
  });

  it('parses "true" as true', () => {
    expect(parseBoolQueryParam("true")).toBe(true);
  });

  it("accepts 1/0 shorthands", () => {
    expect(parseBoolQueryParam("1")).toBe(true);
    expect(parseBoolQueryParam("0")).toBe(false);
  });

  it("is case/whitespace tolerant", () => {
    expect(parseBoolQueryParam(" TRUE ")).toBe(true);
    expect(parseBoolQueryParam("False")).toBe(false);
  });

  it("passes through real booleans", () => {
    expect(parseBoolQueryParam(true)).toBe(true);
    expect(parseBoolQueryParam(false)).toBe(false);
  });

  it("returns undefined for absent/garbage values", () => {
    expect(parseBoolQueryParam(undefined)).toBeUndefined();
    expect(parseBoolQueryParam(null)).toBeUndefined();
    expect(parseBoolQueryParam("yes")).toBeUndefined();
    expect(parseBoolQueryParam("")).toBeUndefined();
    expect(parseBoolQueryParam(["true"])).toBeUndefined();
  });
});

describe("normalizeBoolQueryParams", () => {
  it("converts only the named keys and leaves the rest untouched", () => {
    const out = normalizeBoolQueryParams(
      { forInstitute: "false", page: "2", search: "true" },
      ["forInstitute"],
    );
    expect(out).toEqual({ forInstitute: false, page: "2", search: "true" });
  });

  it("drops an unrecognised value so an optional flag stays optional instead of 400ing", () => {
    const out = normalizeBoolQueryParams({ passed: "maybe", page: "1" }, ["passed"]);
    expect(out).toEqual({ page: "1" });
    expect("passed" in out).toBe(false);
  });

  it("leaves the object alone when the key is absent", () => {
    expect(normalizeBoolQueryParams({ page: "1" }, ["unreadOnly"])).toEqual({ page: "1" });
  });

  it("does not mutate the input", () => {
    const input = { success: "false" };
    normalizeBoolQueryParams(input, ["success"]);
    expect(input.success).toBe("false");
  });
});

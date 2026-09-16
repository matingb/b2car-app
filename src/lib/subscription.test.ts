import { describe, expect, it } from "vitest";
import {
  SubscriptionPlan,
  normalizeSubscriptionPlan,
} from "./subscription";

describe("SubscriptionPlan", () => {
  it("defines BASE and PRO plans", () => {
    expect(SubscriptionPlan.Base).toBe("BASE");
    expect(SubscriptionPlan.Pro).toBe("PRO");
  });

  it("normalizes valid plans", () => {
    expect(normalizeSubscriptionPlan("BASE")).toBe(SubscriptionPlan.Base);
    expect(normalizeSubscriptionPlan("PRO")).toBe(SubscriptionPlan.Pro);
  });

  it("returns null for invalid or missing plans", () => {
    expect(normalizeSubscriptionPlan(undefined)).toBeNull();
    expect(normalizeSubscriptionPlan(null)).toBeNull();
    expect(normalizeSubscriptionPlan("ENTERPRISE")).toBeNull();
    expect(normalizeSubscriptionPlan("")).toBeNull();
  });
});

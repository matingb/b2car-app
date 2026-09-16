export const SubscriptionPlan = {
  Base: "BASE",
  Pro: "PRO",
} as const;

export type SubscriptionPlanValue =
  typeof SubscriptionPlan[keyof typeof SubscriptionPlan];

export function normalizeSubscriptionPlan(value: unknown): SubscriptionPlanValue | null {
  return value === SubscriptionPlan.Base || value === SubscriptionPlan.Pro ? value : null;
}

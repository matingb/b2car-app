export const SubscriptionPlan = {
  Base: "BASE",
  Pro: "PRO",
} as const;

export type SubscriptionPlanValue =
  typeof SubscriptionPlan[keyof typeof SubscriptionPlan];

export const Feature = {
  Billing: "billing",
  Settings: "settings",
} as const;

export type FeatureValue = typeof Feature[keyof typeof Feature];

const PLAN_FEATURES: Record<SubscriptionPlanValue, Record<FeatureValue, boolean>> = {
  [SubscriptionPlan.Base]: {
    [Feature.Billing]: false,
    [Feature.Settings]: false,
  },
  [SubscriptionPlan.Pro]: {
    [Feature.Billing]: true,
    [Feature.Settings]: true,
  },
};

export function normalizeSubscriptionPlan(value: unknown): SubscriptionPlanValue | null {
  return value === SubscriptionPlan.Base || value === SubscriptionPlan.Pro ? value : null;
}

/**
 * Sólo se definen features restringidas. Un claim ausente o inválido nunca
 * habilita una de ellas.
 */
export function hasFeature(plan: unknown, feature: FeatureValue): boolean {
  const normalizedPlan = normalizeSubscriptionPlan(plan);
  return normalizedPlan ? PLAN_FEATURES[normalizedPlan][feature] : false;
}

function hasPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isResourceActionPath(pathname: string, resource: string, action: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 4
    && segments[0] === "api"
    && segments[1] === resource
    && Boolean(segments[2])
    && segments[3] === action;
}

/** Returns the Pro feature required by a B2Car page or API route, if any. */
export function featureForPath(pathname: string): FeatureValue | null {
  if (hasPathPrefix(pathname, "/facturacion") || hasPathPrefix(pathname, "/api/facturas")) {
    return Feature.Billing;
  }

  if (hasPathPrefix(pathname, "/configuracion")
    || hasPathPrefix(pathname, "/api/facturacion/configuracion")) {
    return Feature.Settings;
  }

  if (
    isResourceActionPath(pathname, "arreglos", "factura")
    || isResourceActionPath(pathname, "operaciones", "factura")
    || pathname === "/api/fiscal/condicion-iva"
  ) {
    return Feature.Billing;
  }

  return null;
}

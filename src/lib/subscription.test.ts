import { describe, expect, it } from "vitest";
import {
  Feature,
  SubscriptionPlan,
  featureForPath,
  hasFeature,
  normalizeSubscriptionPlan,
} from "./subscription";

describe("subscription features", () => {
  it.each([
    [SubscriptionPlan.Base, Feature.Billing, false],
    [SubscriptionPlan.Base, Feature.Settings, false],
    [SubscriptionPlan.Pro, Feature.Billing, true],
    [SubscriptionPlan.Pro, Feature.Settings, true],
  ] as const)("%s %s => %s", (plan, feature, expected) => {
    expect(hasFeature(plan, feature)).toBe(expected);
  });

  it("denies Pro features when the claim is absent or invalid", () => {
    expect(hasFeature(undefined, Feature.Billing)).toBe(false);
    expect(hasFeature("ENTERPRISE", Feature.Settings)).toBe(false);
    expect(normalizeSubscriptionPlan("ENTERPRISE")).toBeNull();
  });
});

describe("subscription route matching", () => {
  it.each([
    ["/facturacion", Feature.Billing],
    ["/facturacion/invoice-1", Feature.Billing],
    ["/configuracion", Feature.Settings],
    ["/api/facturas", Feature.Billing],
    ["/api/facturas/invoice-1/pdf", Feature.Billing],
    ["/api/facturacion/configuracion/probar", Feature.Settings],
    ["/api/arreglos/arreglo-1/factura", Feature.Billing],
    ["/api/operaciones/operacion-1/factura", Feature.Billing],
    ["/api/fiscal/condicion-iva", Feature.Billing],
  ] as const)(("maps %s to %s"), (pathname, feature) => {
    expect(featureForPath(pathname)).toBe(feature);
  });

  it.each([
    "/api/facturas-old",
    "/api/facturacion/configuracion-old",
    "/api/arreglos/arreglo-1/factura/extra",
    "/api/fiscal/persona",
    "/clientes",
  ])("does not overmatch %s", (pathname) => {
    expect(featureForPath(pathname)).toBeNull();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/supabase/server";
import { fetchEffectivePermissions } from "@/lib/permissions.server";
import { Permission } from "@/lib/permissions";
import { mockApiSession } from "@/tests/apiRoute";
import { tagDatadogTenant } from "@/lib/datadogTrace";
import { buildApiContext } from "./apiContext";

vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/permissions.server", () => ({ fetchEffectivePermissions: vi.fn(), fetchPlanPermissions: vi.fn() }));
vi.mock("@/lib/datadogTrace", () => ({ tagDatadogTenant: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

describe("buildApiContext", () => {
  it("creates one client, validates claims once and preloads synchronous permissions", async () => {
    const { supabase, getClaims } = mockApiSession({ role: "operativo", plan: "BASE", permissions: [Permission.ArreglosView] });
    const ctx = await buildApiContext();
    expect(ctx.supabase).toBe(supabase);
    expect(ctx.actor).toEqual({ userId: "11111111-1111-4111-8111-111111111111", tenantId: "22222222-2222-4222-8222-222222222222", role: "operativo", plan: "BASE" });
    expect(ctx.can(Permission.ArreglosView)).toBe(true);
    expect(ctx.can(Permission.FinanzasEdit)).toBe(false);
    expect(ctx.can(Permission.ArreglosView)).toBe(true);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(getClaims).toHaveBeenCalledTimes(1);
    expect(tagDatadogTenant).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222", undefined, "BASE");
    expect(fetchEffectivePermissions).toHaveBeenCalledExactlyOnceWith(supabase, "operativo", "BASE");
  });

  it.each([
    null, {}, { sub: "" }, { sub: 2 }, { sub: "invalid" }, { tenant_id: " " }, { tenant_id: null }, { tenant_id: "invalid" },
    { user_role: "" }, { user_role: 123 }, { user_role: undefined }, { plan_sub: "FREE" }, { plan_sub: undefined },
  ])("rejects missing or invalid claims before fetching permissions: %j", async (overrides) => {
    const valid = mockApiSession().claims;
    mockApiSession({ claims: overrides === null || Object.keys(overrides).length === 0 ? overrides : { ...valid, ...overrides } });
    await expect(buildApiContext()).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
    expect(fetchEffectivePermissions).not.toHaveBeenCalled();
  });

  it("rejects authentication errors even if claims are present", async () => {
    mockApiSession({ claimsError: new Error("Expired") });
    await expect(buildApiContext()).rejects.toMatchObject({ status: 401 });
    expect(fetchEffectivePermissions).not.toHaveBeenCalled();
  });

  it("loads a custom role's permissions without treating it as admin", async () => {
    const { supabase } = mockApiSession({
      role: "operativo_arturo", permissions: [Permission.ArreglosView, Permission.ProductosEdit],
    });
    const ctx = await buildApiContext();
    expect(ctx.actor.role).toBe("operativo_arturo");
    expect(fetchEffectivePermissions).toHaveBeenCalledWith(supabase, "operativo_arturo", "PRO");
    expect(ctx.can(Permission.ProductosEdit)).toBe(true);
    expect(ctx.can(Permission.DashboardView)).toBe(false);
    expect(ctx.can(Permission.FacturasView)).toBe(false);
  });

  it("does not grant permissions to a role without grants", async () => {
    mockApiSession({ role: "sin_permisos", permissions: [] });
    const ctx = await buildApiContext();
    expect(Object.values(Permission).some(ctx.can)).toBe(false);
  });

  it("propagates permission loading errors before a controller can mutate data", async () => {
    mockApiSession();
    const error = new Error("Permission query failed");
    vi.mocked(fetchEffectivePermissions).mockRejectedValueOnce(error);
    await expect(buildApiContext()).rejects.toBe(error);
  });
});

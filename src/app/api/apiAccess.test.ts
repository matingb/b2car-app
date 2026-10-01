import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPlanPermissions } from "@/lib/permissions.server";
import { Permission, type PermissionValue } from "@/lib/permissions";
import { mockApiSession } from "@/tests/apiRoute";
import { buildApiContext } from "./apiContext";
import { assertPermission } from "./apiAccess";

vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/permissions.server", () => ({ fetchEffectivePermissions: vi.fn(), fetchPlanPermissions: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

describe("assertPermission", () => {
  it("does not query the plan when all required permissions are granted", async () => {
    mockApiSession();
    const ctx = await buildApiContext();
    await assertPermission(ctx, Permission.FinanzasEdit);
    await assertPermission(ctx, [Permission.FinanzasView, Permission.FinanzasEdit]);
    await assertPermission(ctx, []);
    expect(fetchPlanPermissions).not.toHaveBeenCalled();
  });

  it.each([
    { planPermissions: [Permission.FinanzasEdit], code: "FORBIDDEN" },
    { planPermissions: [], code: "FEATURE_NOT_AVAILABLE_FOR_PLAN" },
  ])("distinguishes role and plan denials: $code", async ({ planPermissions, code }) => {
    mockApiSession({ permissions: [], planPermissions });
    const ctx = await buildApiContext();
    await expect(assertPermission(ctx, Permission.FinanzasEdit)).rejects.toMatchObject({ status: 403, code });
    expect(fetchPlanPermissions).toHaveBeenCalledExactlyOnceWith(ctx.supabase, ctx.actor.plan);
  });

  it("requires every permission and prioritizes a missing plan feature", async () => {
    mockApiSession({ permissions: [Permission.ArreglosView], planPermissions: [Permission.ArreglosView, Permission.FinanzasView] });
    const ctx = await buildApiContext();
    const required: PermissionValue[] = [Permission.ArreglosView, Permission.FinanzasView, Permission.FinanzasEdit];
    await expect(assertPermission(ctx, required)).rejects.toMatchObject({ code: "FEATURE_NOT_AVAILABLE_FOR_PLAN" });
  });

  it("propagates plan query failures", async () => {
    mockApiSession({ permissions: [] });
    const ctx = await buildApiContext();
    const error = new Error("Plan lookup failed");
    vi.mocked(fetchPlanPermissions).mockRejectedValueOnce(error);
    await expect(assertPermission(ctx, Permission.FinanzasEdit)).rejects.toBe(error);
  });
});

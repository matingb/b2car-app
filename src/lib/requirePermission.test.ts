import { beforeEach, describe, expect, it, vi } from "vitest";
import { requirePermission } from "./requirePermission";
import { Permission, UserRole } from "./permissions";
import { SubscriptionPlan } from "./subscription";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  fetchEffectivePermissions: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/supabase/server", () => ({
  createClient: () => mocks.createClient(),
}));

vi.mock("@/lib/permissions.server", () => ({
  fetchEffectivePermissions: (...args: unknown[]) => mocks.fetchEffectivePermissions(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("requirePermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({
      auth: { getClaims: mocks.getClaims },
    });
  });

  it("retorna 401 si no hay claims o hay error", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: new Error("No session") });

    const response = await requirePermission(Permission.DashboardView);
    expect(response).not.toBeNull();
    expect(response?.status).toBe(401);
    const json = await response?.json();
    expect(json).toEqual({ error: "Unauthorized" });
  });

  it("retorna 401 si el rol o el plan no son válidos", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { user_role: "", plan_sub: SubscriptionPlan.Pro } },
      error: null,
    });

    const response = await requirePermission(Permission.DashboardView);
    expect(response?.status).toBe(401);
  });

  it("retorna 403 si el permiso no está en los permisos efectivos", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { user_role: UserRole.Operativo, plan_sub: SubscriptionPlan.Pro } },
      error: null,
    });
    mocks.fetchEffectivePermissions.mockResolvedValue([Permission.ArreglosView]);

    const response = await requirePermission(Permission.DashboardView);
    expect(response?.status).toBe(403);
    const json = await response?.json();
    expect(json).toEqual({ error: "FORBIDDEN_INSUFFICIENT_PERMISSIONS" });
  });

  it("retorna 500 si la consulta a la BD falla", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { user_role: UserRole.Admin, plan_sub: SubscriptionPlan.Pro } },
      error: null,
    });
    mocks.fetchEffectivePermissions.mockRejectedValue(new Error("DB error"));

    const response = await requirePermission(Permission.DashboardView);
    expect(response?.status).toBe(500);
    const json = await response?.json();
    expect(json).toEqual({ error: "Error al verificar permisos" });
  });

  it("retorna null si el permiso está concedido", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { user_role: UserRole.Admin, plan_sub: SubscriptionPlan.Pro } },
      error: null,
    });
    mocks.fetchEffectivePermissions.mockResolvedValue([
      Permission.DashboardView,
      Permission.OperacionesView,
    ]);

    const response = await requirePermission(Permission.DashboardView);
    expect(response).toBeNull();
  });

  it("permite productos y precios a un rol personalizado, y bloquea dashboard y facturación", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { user_role: "operativo_arturo", plan_sub: SubscriptionPlan.Pro } },
      error: null,
    });
    mocks.fetchEffectivePermissions.mockResolvedValue([
      Permission.ProductosEdit, Permission.ArreglosPreciosEdit,
    ]);
    expect(await requirePermission(Permission.ProductosEdit)).toBeNull();
    expect(await requirePermission(Permission.ArreglosPreciosEdit)).toBeNull();
    expect((await requirePermission(Permission.DashboardView))?.status).toBe(403);
    expect((await requirePermission(Permission.FacturasView))?.status).toBe(403);
    expect(mocks.fetchEffectivePermissions).toHaveBeenCalledWith(expect.anything(), "operativo_arturo", "PRO");
  });
});

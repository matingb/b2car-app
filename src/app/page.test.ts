import { beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "@/lib/permissions";

const mocks = vi.hoisted(() => ({ getClaims: vi.fn(), fetchEffectivePermissions: vi.fn() }));
const supabase = { auth: { getClaims: mocks.getClaims } };

vi.mock("@/supabase/server", () => ({ createClient: async () => supabase }));
vi.mock("@/lib/permissions.server", () => ({ fetchEffectivePermissions: mocks.fetchEffectivePermissions }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`); },
}));

import HomePage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getClaims.mockResolvedValue({
    data: { claims: { user_role: "operativo_arturo", plan_sub: "PRO" } }, error: null,
  });
  mocks.fetchEffectivePermissions.mockResolvedValue([Permission.ArreglosView, Permission.ProductosEdit]);
});

describe("HomePage permission-based landing", () => {
  it("envía operativo_arturo a trabajos con los permisos de la base", async () => {
    await expect(HomePage()).rejects.toThrow("redirect:/arreglos");
    expect(mocks.fetchEffectivePermissions).toHaveBeenCalledExactlyOnceWith(supabase, "operativo_arturo", "PRO");
  });

  it("elige el dashboard por permiso, aunque el rol sea personalizado", async () => {
    mocks.fetchEffectivePermissions.mockResolvedValue([Permission.DashboardView]);
    await expect(HomePage()).rejects.toThrow("redirect:/dashboard");
  });

  it("no asigna el dashboard por el nombre admin", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { user_role: "admin", plan_sub: "PRO" } }, error: null });
    mocks.fetchEffectivePermissions.mockResolvedValue([Permission.ProductosView]);
    await expect(HomePage()).rejects.toThrow("redirect:/productos");
  });

  it.each([
    { data: null, error: null },
    { data: { claims: { user_role: "", plan_sub: "PRO" } }, error: null },
    { data: { claims: { user_role: "operativo_arturo", plan_sub: "FREE" } }, error: null },
    { data: { claims: { user_role: "admin", plan_sub: "PRO" } }, error: new Error("Expired") },
  ])("envía claims inválidos a login sin consultar permisos", async (result) => {
    mocks.getClaims.mockResolvedValue(result);
    await expect(HomePage()).rejects.toThrow("redirect:/login");
    expect(mocks.fetchEffectivePermissions).not.toHaveBeenCalled();
  });

  it("envía un rol sin permisos a login", async () => {
    mocks.fetchEffectivePermissions.mockResolvedValue([]);
    await expect(HomePage()).rejects.toThrow("redirect:/login");
  });

  it("no elige un destino si falla la consulta de permisos", async () => {
    const error = new Error("DB unavailable");
    mocks.fetchEffectivePermissions.mockRejectedValue(error);
    await expect(HomePage()).rejects.toBe(error);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  maybeSingle: vi.fn(),
}));

function serverClient() {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: mocks.maybeSingle,
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return {
    auth: { getClaims: mocks.getClaims },
    from: vi.fn(() => query),
  };
}

vi.mock("server-only", () => ({}));
vi.mock("@/supabase/server", () => ({
  createClient: async () => serverClient(),
}));

import {
  FacturacionHttpError,
  requireTenantActor,
  requireTenantAdmin,
} from "./serverAuth";

beforeEach(() => {
  mocks.getClaims.mockReset();
  mocks.maybeSingle.mockReset();
  mocks.getClaims.mockResolvedValue({
    data: {
      claims: {
        sub: "user-1",
        tenant_id: "tenant-1",
        user_role: "admin",
      },
    },
    error: null,
  });
  mocks.maybeSingle.mockResolvedValue({
    data: { tenant_id: "tenant-1", rol: "admin" },
    error: null,
  });
});

describe("autorización fiscal tenant-scoped", () => {
  it("combina claims firmados con la membresía administrativa viva", async () => {
    await expect(requireTenantAdmin()).resolves.toMatchObject({
      userId: "user-1",
      tenantId: "tenant-1",
      role: "admin",
      claimedRole: "admin",
    });
  });

  it("distingue una membresía inexistente", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(requireTenantActor()).rejects.toMatchObject({
      status: 403,
      message: "No se encontró una membresía de tenant activa",
    } satisfies Partial<FacturacionHttpError>);
  });

  it("reporta como error interno una consulta de membresía fallida", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: "query error" } });
    await expect(requireTenantActor()).rejects.toMatchObject({
      status: 500,
      message: expect.stringContaining("configuración interna"),
    });
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error al validar membresía de tenant para facturación:",
      expect.objectContaining({ message: "query error" }),
    );
    consoleSpy.mockRestore();
  });

  it("rechaza si el rol firmado o el rol vivo no es admin", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1", tenant_id: "tenant-1", user_role: "editor" } },
      error: null,
    });
    await expect(requireTenantAdmin()).rejects.toMatchObject({ status: 403 });
  });

  it("permite a un usuario no admin autenticado operar con su tenant", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-2", tenant_id: "tenant-2", user_role: "empleado" } },
      error: null,
    });
    mocks.maybeSingle.mockResolvedValue({
      data: { tenant_id: "tenant-2", rol: "empleado" },
      error: null,
    });
    await expect(requireTenantActor()).resolves.toEqual({
      userId: "user-2",
      tenantId: "tenant-2",
      role: "empleado",
      claimedRole: "empleado",
    });
  });
});

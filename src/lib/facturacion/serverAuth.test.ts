import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  maybeSingle: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: mocks.getClaims } }),
}));
vi.mock("@/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import {
  FacturacionHttpError,
  requireTenantActor,
  requireTenantAdmin,
} from "./serverAuth";

function adminClient() {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: mocks.maybeSingle,
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return { from: vi.fn(() => query) };
}

beforeEach(() => {
  mocks.getClaims.mockReset();
  mocks.maybeSingle.mockReset();
  mocks.createAdminClient.mockReset();
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
  mocks.createAdminClient.mockImplementation(adminClient);
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

  it("reporta como error interno una service_role inválida o una consulta privilegiada fallida", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: "invalid api key" } });
    await expect(requireTenantActor()).rejects.toMatchObject({
      status: 500,
      message: expect.stringContaining("configuración interna"),
    });
  });

  it("rechaza si el rol firmado o el rol vivo no es admin", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1", tenant_id: "tenant-1", user_role: "editor" } },
      error: null,
    });
    await expect(requireTenantAdmin()).rejects.toMatchObject({ status: 403 });
  });
});

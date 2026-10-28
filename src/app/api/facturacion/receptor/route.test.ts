import { beforeEach, describe, expect, it, vi } from "vitest";

const { precarga, actor } = vi.hoisted(() => ({ precarga: vi.fn(), actor: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/facturacion/facturacionService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/facturacion/facturacionService")>();
  return { ...actual, getReceptorPrecarga: precarga };
});
vi.mock("@/lib/facturacion/serverAuth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/facturacion/serverAuth")>();
  return { ...actual, requireTenantBillingActor: actor };
});
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  actor.mockResolvedValue({ tenantId: "tenant", userId: "user" });
});

describe("GET /api/facturacion/receptor", () => {
  it("devuelve la precarga fiscal del cliente del origen sin caché", async () => {
    const data = { receptor: { clienteId: "c", nombre: "Juan" }, clienteAsociado: { clienteId: "c", nombre: "Juan", documento: null } };
    precarga.mockResolvedValue(data);

    const response = await GET(new Request("http://localhost/api/facturacion/receptor?origenTipo=VENTA&origenId=venta-1"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({ data, error: null });
    expect(precarga).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant" }), "VENTA", "venta-1");
  });

  it("rechaza un origen inválido sin consultar al cliente", async () => {
    const response = await GET(new Request("http://localhost/api/facturacion/receptor?origenTipo=NOTA&origenId=x"));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: "El origen de la factura no es válido" });
    expect(precarga).not.toHaveBeenCalled();
  });
});

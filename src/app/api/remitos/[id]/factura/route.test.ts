import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mockApiSession } from "@/tests/apiRoute";
import { logger } from "@/lib/logger";
import { Permission } from "@/lib/permissions";
import { asociarFactura } from "@/lib/remitos/remitosService";
import { POST } from "./route";

vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/permissions.server", () => ({ fetchEffectivePermissions: vi.fn(), fetchPlanPermissions: vi.fn() }));
vi.mock("@/lib/remitos/remitosService", () => ({ asociarFactura: vi.fn() }));

const REMITO_ID = "33333333-3333-4333-8333-333333333333";
const FACTURA_ID = "44444444-4444-4444-8444-444444444444";
const LINEA_REMITO = "55555555-5555-4555-8555-555555555555";
const LINEA_FACTURA = "66666666-6666-4666-8666-666666666666";
const segment = () => ({ params: Promise.resolve({ id: REMITO_ID }) });
const req = (body: unknown) => new NextRequest(`http://localhost/api/remitos/${REMITO_ID}/factura`, {
  method: "POST",
  body: JSON.stringify(body),
});
const body = { facturaId: FACTURA_ID, lineas: [{ remitoLineaId: LINEA_REMITO, facturaLineaId: LINEA_FACTURA }] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(logger, "warn").mockImplementation(() => {});
});

describe("POST /api/remitos/[id]/factura", () => {
  it("requiere facturas:edit", async () => {
    mockApiSession({ permissions: [Permission.FacturasView] });
    expect((await POST(req(body), segment())).status).toBe(403);
    expect(asociarFactura).not.toHaveBeenCalled();
  });

  it("valida el mapeo", async () => {
    mockApiSession();
    const response = await POST(req({ facturaId: FACTURA_ID, lineas: [] }), segment());
    expect(response.status).toBe(400);
    expect(asociarFactura).not.toHaveBeenCalled();
  });

  it("asocia con el mapeo validado", async () => {
    const { supabase } = mockApiSession();
    vi.mocked(asociarFactura).mockResolvedValueOnce(REMITO_ID);

    const response = await POST(req(body), segment());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { id: REMITO_ID }, error: null });
    expect(asociarFactura).toHaveBeenCalledWith(supabase, REMITO_ID, body);
  });

  it("devuelve 409 si el remito ya estaba asociado", async () => {
    mockApiSession();
    vi.mocked(asociarFactura).mockRejectedValueOnce({ code: "55000", message: "El remito ya está asociado a una factura" });
    const response = await POST(req(body), segment());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "El remito ya está asociado a una factura", code: "INMUTABLE" });
  });
});

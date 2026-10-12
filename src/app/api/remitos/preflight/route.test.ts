import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mockApiSession } from "@/tests/apiRoute";
import { logger } from "@/lib/logger";
import { Permission } from "@/lib/permissions";
import { getRemitoPreflight } from "@/lib/remitos/remitosService";
import type { RemitoPreflight } from "@/lib/remitos/types";
import { GET } from "./route";

vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/permissions.server", () => ({ fetchEffectivePermissions: vi.fn(), fetchPlanPermissions: vi.fn() }));
vi.mock("@/lib/remitos/remitosService", () => ({ getRemitoPreflight: vi.fn() }));

const TENANT = "22222222-2222-4222-8222-222222222222";
const FACTURA_ID = "44444444-4444-4444-8444-444444444444";
const ARREGLO_ID = "55555555-5555-4555-8555-555555555555";
const OPERACION_ID = "66666666-6666-4666-8666-666666666666";
const segment = () => ({ params: Promise.resolve({}) });
const req = (query = "") => new NextRequest(`http://localhost/api/remitos/preflight${query}`);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(logger, "warn").mockImplementation(() => {});
});

describe("GET /api/remitos/preflight", () => {
  it("requiere facturas:edit", async () => {
    mockApiSession({ permissions: [Permission.FacturasView] });
    expect((await GET(req(), segment())).status).toBe(403);
  });

  it("valida los identificadores de origen", async () => {
    mockApiSession();
    expect((await GET(req("?facturaId=abc"), segment())).status).toBe(400);
    expect((await GET(req("?arregloId=abc"), segment())).status).toBe(400);
    expect((await GET(req("?operacionId=abc"), segment())).status).toBe(400);
    expect(getRemitoPreflight).not.toHaveBeenCalled();
  });

  it.each([
    ["", null, null, null],
    [`?facturaId=${FACTURA_ID}`, FACTURA_ID, null, null],
    [`?arregloId=${ARREGLO_ID}`, null, ARREGLO_ID, null],
    [`?operacionId=${OPERACION_ID}`, null, null, OPERACION_ID],
  ])("prepara la emisión (%s)", async (query, facturaId, arregloId, operacionId) => {
    const { supabase } = mockApiSession();
    const preflight = { ambiente: "HOMOLOGACION" } as RemitoPreflight;
    vi.mocked(getRemitoPreflight).mockResolvedValueOnce(preflight);

    const response = await GET(req(query), segment());

    expect(await response.json()).toEqual({ data: preflight, error: null });
    expect(getRemitoPreflight).toHaveBeenCalledWith(supabase, TENANT, "HOMOLOGACION", facturaId, arregloId, operacionId);
  });
});

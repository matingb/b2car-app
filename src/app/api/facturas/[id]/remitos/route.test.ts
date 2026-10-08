import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mockApiSession } from "@/tests/apiRoute";
import { logger } from "@/lib/logger";
import { getFacturaRemitos } from "@/lib/remitos/remitosService";
import { GET } from "./route";

vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/permissions.server", () => ({ fetchEffectivePermissions: vi.fn(), fetchPlanPermissions: vi.fn() }));
vi.mock("@/lib/remitos/remitosService", () => ({ getFacturaRemitos: vi.fn() }));

const TENANT = "22222222-2222-4222-8222-222222222222";
const FACTURA_ID = "44444444-4444-4444-8444-444444444444";
const segment = (id = FACTURA_ID) => ({ params: Promise.resolve({ id }) });
const req = () => new NextRequest(`http://localhost/api/facturas/${FACTURA_ID}/remitos`);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(logger, "warn").mockImplementation(() => {});
});

describe("GET /api/facturas/[id]/remitos", () => {
  it("requiere facturas:view y un id válido", async () => {
    mockApiSession({ permissions: [] });
    expect((await GET(req(), segment())).status).toBe(403);
    mockApiSession();
    expect((await GET(req(), segment("x"))).status).toBe(400);
    expect(getFacturaRemitos).not.toHaveBeenCalled();
  });

  it("devuelve remitos y disponibles de la factura", async () => {
    const { supabase } = mockApiSession();
    const data = { remitos: [], lineas: [] };
    vi.mocked(getFacturaRemitos).mockResolvedValueOnce(data);

    const response = await GET(req(), segment());

    expect(await response.json()).toEqual({ data, error: null });
    expect(getFacturaRemitos).toHaveBeenCalledWith(supabase, TENANT, FACTURA_ID);
  });
});

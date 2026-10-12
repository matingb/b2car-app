import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mockApiSession } from "@/tests/apiRoute";
import { logger } from "@/lib/logger";
import { listDocumentosAsociados } from "@/lib/documentos/documentosService";
import { GET } from "./route";

vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/permissions.server", () => ({ fetchEffectivePermissions: vi.fn(), fetchPlanPermissions: vi.fn() }));
vi.mock("@/lib/documentos/documentosService", () => ({ listDocumentosAsociados: vi.fn() }));

const TENANT = "22222222-2222-4222-8222-222222222222";
const ORIGEN_ID = "55555555-5555-4555-8555-555555555555";
const segment = (id = ORIGEN_ID) => ({ params: Promise.resolve({ id }) });
const req = () => new NextRequest(`http://localhost/api/arreglos/${ORIGEN_ID}/documentos`);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(logger, "warn").mockImplementation(() => {});
});

describe("GET /api/arreglos/[id]/documentos", () => {
  it("requiere facturas:view y un id válido", async () => {
    mockApiSession({ permissions: [] });
    expect((await GET(req(), segment())).status).toBe(403);
    mockApiSession();
    expect((await GET(req(), segment("x"))).status).toBe(400);
    expect(listDocumentosAsociados).not.toHaveBeenCalled();
  });

  it("devuelve los documentos asociados en el ambiente actual", async () => {
    const { supabase } = mockApiSession();
    vi.mocked(listDocumentosAsociados).mockResolvedValueOnce([]);

    const response = await GET(req(), segment());

    expect(await response.json()).toEqual({ data: [], error: null });
    expect(listDocumentosAsociados).toHaveBeenCalledWith(supabase, TENANT, "HOMOLOGACION", { tipo: "ARREGLO", id: ORIGEN_ID });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mockApiSession } from "@/tests/apiRoute";
import { logger } from "@/lib/logger";
import { Permission } from "@/lib/permissions";
import { getRemitoDetalle } from "@/lib/remitos/remitosService";
import type { RemitoDetalle } from "@/lib/remitos/types";
import { ApiError } from "../../apiError";
import { GET } from "./route";

vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/permissions.server", () => ({ fetchEffectivePermissions: vi.fn(), fetchPlanPermissions: vi.fn() }));
vi.mock("@/lib/remitos/remitosService", () => ({ getRemitoDetalle: vi.fn() }));

const REMITO_ID = "33333333-3333-4333-8333-333333333333";
const TENANT = "22222222-2222-4222-8222-222222222222";
const segment = (id = REMITO_ID) => ({ params: Promise.resolve({ id }) });
const req = () => new NextRequest(`http://localhost/api/remitos/${REMITO_ID}`);
const detalle = { id: REMITO_ID, numeroVisible: "X 00001-00000001" } as RemitoDetalle;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(logger, "warn").mockImplementation(() => {});
  vi.spyOn(logger, "error").mockImplementation(() => {});
});

describe("GET /api/remitos/[id]", () => {
  it("requiere facturas:view y un id válido", async () => {
    mockApiSession({ permissions: [] });
    expect((await GET(req(), segment())).status).toBe(403);

    mockApiSession();
    const invalid = await GET(req(), segment("no-uuid"));
    expect(invalid.status).toBe(400);
    expect(getRemitoDetalle).not.toHaveBeenCalled();
  });

  it.each([
    [[Permission.FacturasView, Permission.FacturasEdit], true],
    [[Permission.FacturasView], false],
  ])("informa canManage según facturas:edit (%o)", async (permissions, canManage) => {
    const { supabase } = mockApiSession({ permissions });
    vi.mocked(getRemitoDetalle).mockResolvedValueOnce(detalle);

    const response = await GET(req(), segment());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: detalle, canManage, error: null });
    expect(getRemitoDetalle).toHaveBeenCalledWith(supabase, TENANT, REMITO_ID);
  });

  it("responde 404 cuando no existe", async () => {
    mockApiSession();
    vi.mocked(getRemitoDetalle).mockRejectedValueOnce(new ApiError(404, "Remito no encontrado", "NOT_FOUND"));
    const response = await GET(req(), segment());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Remito no encontrado", code: "NOT_FOUND" });
  });
});

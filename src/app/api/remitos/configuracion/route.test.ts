import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mockApiSession } from "@/tests/apiRoute";
import { logger } from "@/lib/logger";
import { Permission } from "@/lib/permissions";
import { getRemitosConfiguracion, saveRemitosConfiguracion } from "@/lib/remitos/remitosService";
import type { RemitosConfiguracion } from "@/lib/remitos/types";
import { GET, PUT } from "./route";

vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/permissions.server", () => ({ fetchEffectivePermissions: vi.fn(), fetchPlanPermissions: vi.fn() }));
vi.mock("@/lib/remitos/remitosService", () => ({ getRemitosConfiguracion: vi.fn(), saveRemitosConfiguracion: vi.fn() }));

const TENANT = "22222222-2222-4222-8222-222222222222";
const USER = "11111111-1111-4111-8111-111111111111";
const segment = () => ({ params: Promise.resolve({}) });
const put = (body: unknown) => new NextRequest("http://localhost/api/remitos/configuracion", {
  method: "PUT",
  body: JSON.stringify(body),
});
const input = {
  remitoR: {
    cai: null, caiVencimiento: null, puntoEmision: null, numeroDesde: null, numeroHasta: null, proximoNumero: 1,
    inicioActividades: null, autoimpresor: false,
    imprenta: { razonSocial: null, cuit: null, fechaImpresion: null, habilitacion: null },
  },
  remitoX: { puntoEmision: 1, proximoNumero: 1 },
};
const config = { ...input, ambiente: "HOMOLOGACION", ultimoEmitido: { R: null, X: null }, updatedAt: null } as RemitosConfiguracion;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(logger, "warn").mockImplementation(() => {});
});

describe("/api/remitos/configuracion", () => {
  it("GET requiere configuracion:view y facturas:view", async () => {
    mockApiSession({ permissions: [Permission.FacturasView] });
    expect((await GET(new NextRequest("http://localhost/api/remitos/configuracion"), segment())).status).toBe(403);

    const { supabase } = mockApiSession({ permissions: [Permission.FacturasView, Permission.ConfiguracionView] });
    vi.mocked(getRemitosConfiguracion).mockResolvedValueOnce(config);
    const response = await GET(new NextRequest("http://localhost/api/remitos/configuracion"), segment());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: config, error: null });
    expect(getRemitosConfiguracion).toHaveBeenCalledWith(supabase, TENANT, "HOMOLOGACION");
  });

  it("PUT requiere configuracion:edit y facturas:edit", async () => {
    mockApiSession({ permissions: [Permission.FacturasEdit, Permission.ConfiguracionView] });
    expect((await PUT(put(input), segment())).status).toBe(403);
    expect(saveRemitosConfiguracion).not.toHaveBeenCalled();
  });

  it("PUT valida y guarda con el usuario actual", async () => {
    const { supabase } = mockApiSession();
    expect((await PUT(put({ ...input, remitoX: { puntoEmision: 0, proximoNumero: 1 } }), segment())).status).toBe(400);

    vi.mocked(saveRemitosConfiguracion).mockResolvedValueOnce(config);
    const response = await PUT(put(input), segment());
    expect(response.status).toBe(200);
    expect(saveRemitosConfiguracion).toHaveBeenCalledWith(supabase, TENANT, USER, "HOMOLOGACION", input);
  });

  it("PUT devuelve el mensaje de numeración progresiva de la base", async () => {
    mockApiSession();
    vi.mocked(saveRemitosConfiguracion).mockRejectedValueOnce({
      code: "P0001",
      message: "El próximo número de Remito X debe ser mayor al último emitido (X 00001-00000004)",
    });
    const response = await PUT(put(input), segment());
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("debe ser mayor al último emitido");
  });
});

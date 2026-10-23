import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPeriodoMock, requirePermissionMock } = vi.hoisted(() => ({
  getPeriodoMock: vi.fn(),
  requirePermissionMock: vi.fn(),
}));

vi.mock("@/supabase/server", () => ({ createClient: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/requirePermission", () => ({ requirePermission: requirePermissionMock }));
vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: { getPeriodo: getPeriodoMock },
}));

import { GET } from "./route";

const periodo = {
  resumen: {
    total: 1,
    cobrados: 1,
    pendientes: 0,
    parciales: 0,
    montoIngresos: 1000,
    montoCobradoTotal: 1000,
    montoCobradoParcial: 0,
    montoPendienteParcial: 0,
    montoPendiente: 0,
  },
  series: { arreglos: [{ fecha: "2026-09-15", cantidad: 1 }], ingresos: [], gastos: [] },
};

const request = (query: string) => new Request(`http://localhost/api/dashboard/periodo${query}`);

describe("GET /api/dashboard/periodo", () => {
  beforeEach(() => {
    getPeriodoMock.mockReset().mockResolvedValue(periodo);
    requirePermissionMock.mockReset().mockResolvedValue(null);
  });

  it("devuelve el período pedido", async () => {
    const res = await GET(request("?from=2026-09-15T03:00:00.000Z&to=2026-10-16T03:00:00.000Z"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: periodo, error: null });
    expect(getPeriodoMock).toHaveBeenCalledWith({}, "2026-09-15T03:00:00.000Z", "2026-10-16T03:00:00.000Z");
  });

  it("responde 400 sin consultar la base si falta el rango o es inválido", async () => {
    const sinRango = await GET(request(""));
    const invertido = await GET(request("?from=2026-10-16T03:00:00.000Z&to=2026-09-15T03:00:00.000Z"));

    expect(sinRango.status).toBe(400);
    expect(invertido.status).toBe(400);
    expect(getPeriodoMock).not.toHaveBeenCalled();
  });

  it("corta antes de validar si no tiene permiso", async () => {
    requirePermissionMock.mockResolvedValue(Response.json({ error: "Forbidden" }, { status: 403 }));

    const res = await GET(request("?from=2026-09-15T03:00:00.000Z&to=2026-10-16T03:00:00.000Z"));

    expect(res.status).toBe(403);
    expect(getPeriodoMock).not.toHaveBeenCalled();
  });

  it("responde 500 con el mensaje si falla la consulta", async () => {
    getPeriodoMock.mockRejectedValue(new Error("db caída"));

    const res = await GET(request("?from=2026-09-15T03:00:00.000Z&to=2026-10-16T03:00:00.000Z"));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ data: null, error: "db caída" });
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PUT } from "./route";
import { ServiceError } from "@/app/api/serviceError";

vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/permissions.server", () => ({ hasUserPermission: vi.fn().mockResolvedValue(true) }));
vi.mock("@/app/api/arreglos/detalleArregloService", () => ({
  detalleArregloService: { updateById: vi.fn(), deleteById: vi.fn() },
}));
vi.mock("@/app/api/arreglos/arregloDescripcionService", () => ({
  syncArregloDescripcion: vi.fn().mockResolvedValue({ error: null }),
}));
vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: { onDataChanged: vi.fn() },
}));

import { createClient } from "@/supabase/server";
import { detalleArregloService } from "@/app/api/arreglos/detalleArregloService";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";

function request(payload: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/arreglos/ARR-1/detalles/DET-1", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

const params = { params: Promise.resolve({ id: "ARR-1", detalleId: "DET-1" }) };

describe("PUT /api/arreglos/[id]/detalles/[detalleId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({} as never);
    vi.mocked(detalleArregloService.updateById).mockResolvedValue({
      data: {
        id: "DET-1",
        arreglo_id: "ARR-1",
        descripcion: "Mano de obra",
        cantidad: 1,
        precio_hora_facturada: 1000,
        horas_facturadas: 1.5,
        horas_trabajadas: 1,
        categoria_arreglo_id: null,
        empleado_id: null,
        created_at: "2026-09-24T00:00:00.000Z",
        updated_at: "2026-09-24T00:00:00.000Z",
      },
      error: null,
    } as never);
  });

  it("devuelve un error claro si se intenta borrar horas ya definidas", async () => {
    vi.mocked(detalleArregloService.updateById).mockResolvedValueOnce({
      data: null,
      error: ServiceError.HorasFacturadasInmutables,
    });

    const response = await PUT(request({ horas_facturadas: null }), params);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/no pueden volver a desconocidas/i);
  });

  it("permite completar horas de una línea histórica que no las tenía", async () => {
    const response = await PUT(request({ horas_facturadas: 1.5 }), params);

    expect(response.status).toBe(200);
    expect(detalleArregloService.updateById).toHaveBeenCalledWith(
      expect.anything(),
      "ARR-1",
      "DET-1",
      { horas_facturadas: 1.5 },
    );
    expect(statsService.onDataChanged).toHaveBeenCalled();
  });
});

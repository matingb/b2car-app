import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/permissions.server", () => ({ hasUserPermission: vi.fn().mockResolvedValue(true) }));
vi.mock("@/app/api/arreglos/detalleArregloService", () => ({
  detalleArregloService: { create: vi.fn() },
}));
vi.mock("@/app/api/arreglos/arregloDescripcionService", () => ({
  syncArregloDescripcion: vi.fn().mockResolvedValue({ error: null }),
}));
vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: { onDataChanged: vi.fn() },
}));

import { createClient } from "@/supabase/server";
import { hasUserPermission } from "@/lib/permissions.server";
import { detalleArregloService } from "@/app/api/arreglos/detalleArregloService";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";

const createdRow = {
  id: "DET-1",
  arreglo_id: "ARR-1",
  descripcion: "Diagnóstico",
  cantidad: 1,
  precio_hora_facturada: 0,
  horas_facturadas: 1,
  horas_trabajadas: 1,
  categoria_arreglo_id: null,
  empleado_id: null,
  created_at: "2026-09-24T00:00:00.000Z",
  updated_at: "2026-09-24T00:00:00.000Z",
};

function request(payload: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/arreglos/ARR-1/detalles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/arreglos/[id]/detalles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({} as never);
    vi.mocked(hasUserPermission).mockResolvedValue(true);
    vi.mocked(detalleArregloService.create).mockResolvedValue({ data: createdRow, error: null });
  });

  it("permite omitir el precio para que la base use el taller del arreglo", async () => {
    const response = await POST(request({ descripcion: "Diagnóstico", cantidad: 1 }), {
      params: Promise.resolve({ id: "ARR-1" }),
    });

    expect(response.status).toBe(201);
    const payload = vi.mocked(detalleArregloService.create).mock.calls[0][1];
    expect(payload).not.toHaveProperty("precio_hora_facturada");
    expect(payload).toMatchObject({ horas_facturadas: 1, horas_trabajadas: 1 });
    expect(statsService.onDataChanged).toHaveBeenCalled();
  });

  it("rechaza horas con más de dos decimales", async () => {
    const response = await POST(request({
      descripcion: "Diagnóstico",
      cantidad: 1,
      horas_facturadas: 1.125,
    }), { params: Promise.resolve({ id: "ARR-1" }) });

    expect(response.status).toBe(400);
    expect(detalleArregloService.create).not.toHaveBeenCalled();
  });

  it("rechaza un costo horario manual si falta permiso de edición de empleados", async () => {
    vi.mocked(hasUserPermission).mockResolvedValue(false);
    const response = await POST(request({
      descripcion: "Diagnóstico",
      cantidad: 1,
      valor_hora_empleado: 0,
    }), { params: Promise.resolve({ id: "ARR-1" }) });

    expect(response.status).toBe(403);
    expect(detalleArregloService.create).not.toHaveBeenCalled();
  });
});

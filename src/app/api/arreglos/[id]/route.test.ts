import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT, DELETE } from "./route";
import { createClient } from "@/supabase/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { arregloService } from "../arregloService";
import { syncArregloDescripcion } from "../arregloDescripcionService";
import { arregloCompletoService } from "../arregloCompletoService";
import { hasUserPermission } from "@/lib/permissions.server";
import { NextRequest } from "next/server";
import { AuthError } from "@supabase/supabase-js";
import { Arreglo } from "@/model/types";
import { ServiceError } from "@/app/api/serviceError";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/permissions.server", () => ({
  hasUserPermission: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: {
    onDataChanged: vi.fn(),
  },
}));

vi.mock("../arregloService", () => ({
  arregloService: {
    updateById: vi.fn(),
    getByIdWithVehiculo: vi.fn(),
    deleteById: vi.fn(),
  },
}));

vi.mock("../arregloDescripcionService", () => ({
  syncArregloDescripcion: vi.fn(),
}));

vi.mock("../arregloCompletoService", () => ({
  arregloCompletoService: {
    getArregloDetalleCompleto: vi.fn(),
  },
}));

describe("Mutaciones /api/arreglos/[id]", () => {
  let detalleLookupResult: { data: unknown; error: unknown };
  let formularioLookupResult: { data: unknown; error: unknown };

  const mockSupabase = {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: { claims: { user_role: "admin", plan_sub: "PRO" } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "detalle_form_custom") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(async () => detalleLookupResult),
              })),
            })),
          })),
        };
      }

      if (table === "formularios") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => formularioLookupResult),
            })),
          })),
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(async () => ({ data: [], error: null })),
            })),
          })),
        })),
      };
    }),
  } as unknown as Awaited<ReturnType<typeof createClient>>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasUserPermission).mockResolvedValue(true);

    detalleLookupResult = { data: [], error: null };
    formularioLookupResult = { data: null, error: null };

    vi.mocked(createClient).mockResolvedValue(mockSupabase);
    vi.mocked(arregloService.updateById).mockResolvedValue({
      data: { id: "a1", tenant_id: "TEN-1", taller_id: "TAL-1" } as unknown as Arreglo,
      error: null,
    });
    vi.mocked(arregloService.getByIdWithVehiculo).mockResolvedValue({
      data: { id: "a1", tenant_id: "TEN-1", estado: "EN_PROGRESO", taller_id: "TAL-1" } as unknown as Arreglo,
      error: null,
    });
    vi.mocked(arregloService.deleteById).mockResolvedValue(
      { error: null } as unknown as { error: null }
    );
    vi.mocked(syncArregloDescripcion).mockResolvedValue({
      descripcion: "Service | Cambio aceite",
      error: null,
    });
  });

  describe("GET /api/arreglos/[id]", () => {
    const mockDetalleResponse = {
      arreglo: {
        id: "a1",
        precio_final: 15000,
        precio_sin_iva: 12396.69,
        total_cobrado: 5000,
        saldo_pendiente: 10000,
        descripcion: "Frenos",
      } as unknown as Arreglo,
      detalles: [{ id: "d1", arreglo_id: "a1", descripcion: "Pastillas", cantidad: 1, valor: 5000, categoria_arreglo_id: null, empleado_id: null }],
      asignaciones: [],
      detalle_formulario: null,
      cobros: [{ id: "c1", operacion_id: "op1", importe: 5000, cuenta_id: "cta1", cuenta_nombre: "Caja", fecha: "2026-03-01", created_at: "2026-03-01T00:00:00.000Z" }],
    };

    it("devuelve 401 si no hay sesión autenticada", async () => {
      vi.mocked(mockSupabase.auth.getClaims).mockResolvedValueOnce({
        data: null,
        error: new AuthError("Unauthorized"),
      });

      const res = await GET(new NextRequest("http://localhost/api/arreglos/a1"), {
        params: Promise.resolve({ id: "a1" }),
      });
      expect(res.status).toBe(401);
    });

    it("devuelve 404 si el arreglo no existe", async () => {
      vi.mocked(arregloCompletoService.getArregloDetalleCompleto).mockResolvedValueOnce({
        data: null,
        error: ServiceError.NotFound,
      });

      const res = await GET(new NextRequest("http://localhost/api/arreglos/a1"), {
        params: Promise.resolve({ id: "a1" }),
      });
      expect(res.status).toBe(404);
    });

    it("devuelve los precios completos si el usuario tiene ArreglosPreciosView", async () => {
      vi.mocked(arregloCompletoService.getArregloDetalleCompleto).mockResolvedValueOnce({
        data: mockDetalleResponse,
        error: null,
      });

      const res = await GET(new NextRequest("http://localhost/api/arreglos/a1"), {
        params: Promise.resolve({ id: "a1" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.arreglo.precio_final).toBe(15000);
      expect(body.data.detalles[0].valor).toBe(5000);
      expect(body.data.cobros).toHaveLength(1);
    });

    it("redacta precios a 0 y oculta cobros si el usuario no tiene ArreglosPreciosView", async () => {
      vi.mocked(arregloCompletoService.getArregloDetalleCompleto).mockResolvedValueOnce({
        data: mockDetalleResponse,
        error: null,
      });
      vi.mocked(hasUserPermission).mockResolvedValueOnce(false);

      const res = await GET(new NextRequest("http://localhost/api/arreglos/a1"), {
        params: Promise.resolve({ id: "a1" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.arreglo.precio_final).toBe(0);
      expect(body.data.arreglo.total_cobrado).toBe(0);
      expect(body.data.detalles[0].valor).toBe(0);
      expect(body.data.cobros).toEqual([]);
      expect(body.data.arreglo.descripcion).toBe("Frenos");
    });
  });

  it("si update es exitoso, registra cambios en los stats", async () => {
    const req = new NextRequest("http://localhost/api/arreglos/a1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ observaciones: "Nuevas observaciones" }),
    });

    const params = Promise.resolve({ id: "a1" });
    await PUT(req, { params });

    expect(arregloService.updateById).toHaveBeenCalledTimes(1);
    expect(arregloService.updateById).toHaveBeenCalledWith(
      mockSupabase,
      "a1",
      expect.objectContaining({ observaciones: "Nuevas observaciones" })
    );
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledWith(mockSupabase, "TEN-1");
  });

  it("PUT: si el estado es inválido devuelve 400 y no llama al service", async () => {
    const req = new NextRequest("http://localhost/api/arreglos/a1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "pausado" }),
    });

    const response = await PUT(req, { params: Promise.resolve({ id: "a1" }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ data: null, error: "Estado de arreglo inválido" });
    expect(arregloService.updateById).not.toHaveBeenCalled();
    expect(statsService.onDataChanged).not.toHaveBeenCalled();
  });

  it("PUT: normaliza estado (trim + uppercase) antes de llamar al service", async () => {
    const req = new NextRequest("http://localhost/api/arreglos/a1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: " en_progreso " }),
    });

    const response = await PUT(req, { params: Promise.resolve({ id: "a1" }) });

    expect(response.status).toBe(200);
    expect(arregloService.updateById).toHaveBeenCalledWith(
      mockSupabase,
      "a1",
      expect.objectContaining({ estado: "EN_PROGRESO" })
    );
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
  });

  it("PUT: si el service devuelve NotFound, responde 404", async () => {
    vi.mocked(arregloService.updateById).mockResolvedValue({
      data: null,
      error: ServiceError.NotFound,
    });

    const req = new NextRequest("http://localhost/api/arreglos/a1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "TERMINADO" }),
    });

    const response = await PUT(req, { params: Promise.resolve({ id: "a1" }) });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ data: null, error: "Arreglo no encontrado" });
    expect(statsService.onDataChanged).not.toHaveBeenCalled();
  });

  it("PUT: bloquea transicion a TERMINADO cuando faltan required", async () => {
    detalleLookupResult = {
      data: [
        {
          config_id: "f1",
          metadata: [{ title: "Checklist", inputs: [{ title: "Patente", value: null }] }],
        },
      ],
      error: null,
    };
    formularioLookupResult = {
      data: {
        metadata: [
          {
            title: "Checklist",
            inputs: [{ key: "patente", label: "Patente", required: true }],
          },
        ],
      },
      error: null,
    };

    const req = new NextRequest("http://localhost/api/arreglos/a1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "TERMINADO" }),
    });

    const response = await PUT(req, { params: Promise.resolve({ id: "a1" }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(String(body?.error ?? "")).toContain("Patente");
    expect(arregloService.updateById).not.toHaveBeenCalled();
    expect(statsService.onDataChanged).not.toHaveBeenCalled();
  });

  it("PUT: permite transicion a TERMINADO cuando required estan completos", async () => {
    detalleLookupResult = {
      data: [
        {
          config_id: "f1",
          metadata: [{ title: "Checklist", inputs: [{ title: "Patente", value: "AA123BB" }] }],
        },
      ],
      error: null,
    };
    formularioLookupResult = {
      data: {
        metadata: [
          {
            title: "Checklist",
            inputs: [{ key: "patente", label: "Patente", required: true }],
          },
        ],
      },
      error: null,
    };

    const req = new NextRequest("http://localhost/api/arreglos/a1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "TERMINADO" }),
    });

    const response = await PUT(req, { params: Promise.resolve({ id: "a1" }) });

    expect(response.status).toBe(200);
    expect(arregloService.updateById).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
  });

  it("PUT: permite transicion a TERMINADO cuando no hay detalle/config", async () => {
    detalleLookupResult = { data: [], error: null };

    const req = new NextRequest("http://localhost/api/arreglos/a1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "TERMINADO" }),
    });

    const response = await PUT(req, { params: Promise.resolve({ id: "a1" }) });

    expect(response.status).toBe(200);
    expect(arregloService.updateById).toHaveBeenCalledTimes(1);
  });

  it("PUT: rechaza el cambio a estado PRESUPUESTO si el arreglo ya registra pagos", async () => {
    vi.mocked(arregloService.getByIdWithVehiculo).mockResolvedValue({
      data: {
        id: "a1",
        estado: "EN_PROGRESO",
        esta_pago: true,
        total_cobrado: 15000,
      } as unknown as Arreglo,
      error: null,
    });

    const req = new NextRequest("http://localhost/api/arreglos/a1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estado: "PRESUPUESTO",
      }),
    });

    const response = await PUT(req, { params: Promise.resolve({ id: "a1" }) });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("No se puede volver a PRESUPUESTO despues de activar el arreglo");
    expect(arregloService.updateById).not.toHaveBeenCalled();
  });

  it("PUT: si el JSON es inválido, responde 400", async () => {
    const req = new NextRequest("http://localhost/api/arreglos/a1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });

    const response = await PUT(req, { params: Promise.resolve({ id: "a1" }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "JSON inválido" });
    expect(arregloService.updateById).not.toHaveBeenCalled();
    expect(statsService.onDataChanged).not.toHaveBeenCalled();
  });

  it("si delete es exitoso, registra cambios en los stats", async () => {
    const req = {} as NextRequest;
    const params = Promise.resolve({ id: "a1" });
    await DELETE(req, { params });

    expect(arregloService.deleteById).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledWith(mockSupabase, "TEN-1");
  });
});

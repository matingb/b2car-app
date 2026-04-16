import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { createClient } from "@/supabase/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { arregloService } from "./arregloService";
import { Arreglo } from "@/model/types";
import { createCreateArregloRequest } from "@/tests/factories";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: {
    onDataChanged: vi.fn(),
  },
}));

vi.mock("./arregloService", () => ({
  arregloService: {
    create: vi.fn(),
  },
}));

describe("POST /api/arreglos", () => {
  let formularioLookupResult: { data: unknown; error: unknown };
  let detalleInsertResult: { error: unknown };

  const mockSupabase = {
    from: vi.fn((table: string) => {
      if (table === "formularios") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => formularioLookupResult),
            })),
          })),
        };
      }

      if (table === "detalle_form_custom") {
        return {
          insert: vi.fn(async () => detalleInsertResult),
        };
      }

      if (table === "detalle_arreglo") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: "d1",
                  arreglo_id: "a1",
                  descripcion: "Cambio aceite",
                  cantidad: 1,
                  valor: 1000,
                },
                error: null,
              })),
            })),
          })),
        };
      }

      return {
        insert: vi.fn(async () => ({ error: null })),
        select: vi.fn(() => ({
          in: vi.fn(async () => ({ data: [], error: null })),
        })),
      };
    }),
  } as unknown as Awaited<ReturnType<typeof createClient>>;

  beforeEach(() => {
    vi.clearAllMocks();

    formularioLookupResult = { data: null, error: null };
    detalleInsertResult = { error: null };

    vi.mocked(createClient).mockResolvedValue(mockSupabase);
    vi.mocked(arregloService.create).mockResolvedValue({
      data: { id: "a1" } as Arreglo,
      error: null,
    });
  });

  it("si el insert es exitoso, registra cambios en los stats", async () => {
    const req = new Request("http://localhost/api/arreglos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createCreateArregloRequest({
          tipo: "Service",
          detalles: [{ descripcion: "Cambio aceite", cantidad: 1, valor: 1000 }],
        })
      ),
    });

    await POST(req);

    expect(arregloService.create).toHaveBeenCalledTimes(1);
    expect(arregloService.create).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({
        descripcion: "Cambio aceite",
      })
    );
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
  });

  it("bloquea creacion en TERMINADO cuando faltan required", async () => {
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

    const req = new Request("http://localhost/api/arreglos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createCreateArregloRequest({
          estado: "TERMINADO",
          detalle_formulario: {
            formulario_id: "f1",
            costo: 0,
            metadata: [{ title: "Checklist", inputs: [{ title: "Patente", value: null }] }],
          },
        })
      ),
    });

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(String(body?.error ?? "")).toContain("Patente");
    expect(arregloService.create).not.toHaveBeenCalled();
    expect(statsService.onDataChanged).not.toHaveBeenCalled();
  });

  it("permite creacion en TERMINADO cuando required estan completos", async () => {
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

    const req = new Request("http://localhost/api/arreglos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createCreateArregloRequest({
          estado: "TERMINADO",
          detalle_formulario: {
            formulario_id: "f1",
            costo: 0,
            metadata: [{ title: "Checklist", inputs: [{ title: "Patente", value: "AA123BB" }] }],
          },
        })
      ),
    });

    const response = await POST(req);

    expect(response.status).toBe(201);
    expect(arregloService.create).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
  });

  it("permite creacion en TERMINADO sin detalle/config", async () => {
    const req = new Request("http://localhost/api/arreglos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createCreateArregloRequest({
          estado: "TERMINADO",
          detalle_formulario: undefined,
        })
      ),
    });

    const response = await POST(req);

    expect(response.status).toBe(201);
    expect(arregloService.create).toHaveBeenCalledTimes(1);
  });
});
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { DELETE, GET, PUT } from "./route";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/requirePermission", () => ({
  requirePermission: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: {
    onDataChanged: vi.fn(),
  },
}));

import { createClient } from "@/supabase/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { logger } from "@/lib/logger";

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const ORIGINAL_ID = "22222222-2222-4222-8222-222222222222";
const IDEMPOTENCY_KEY = "44444444-4444-4444-8444-444444444444";

function gastoRow(id = ORIGINAL_ID, descripcion = "Alquiler original") {
  return {
    id,
    fecha: "2026-07-31T00:00:00.000Z",
    created_at: "2026-07-31T12:00:00.000Z",
    gasto: { categoria_gasto: "ALQUILER", descripcion },
    pagos: [{ cuenta_id: ACCOUNT_ID, importe: -150000, cuenta: { nombre: "Caja principal" } }],
    monto_total: 150000,
    taller_id: null,
    observaciones: null as string | null,
  };
}

function mockSupabase(rpc = vi.fn()) {
  const maybeSingle = vi.fn();
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle };
  const from = vi.fn().mockReturnValue(query);
  vi.mocked(createClient).mockResolvedValue({ from, rpc } as unknown as SupabaseClient);
  return { from, ...query, rpc };
}

describe("/api/gastos/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("busca el gasto por ID y actualiza solo la descripción", async () => {
    const { from, eq, maybeSingle, rpc } = mockSupabase(vi.fn().mockResolvedValue({ data: ORIGINAL_ID, error: null }));
    maybeSingle
      .mockResolvedValueOnce({ data: gastoRow(), error: null })
      .mockResolvedValueOnce({ data: gastoRow(ORIGINAL_ID, "Alquiler renegociado"), error: null });

    const request = new NextRequest(`http://localhost/api/gastos/${ORIGINAL_ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descripcion: "Alquiler renegociado", idempotencyKey: IDEMPOTENCY_KEY }),
    });
    const response = await PUT(request, { params: Promise.resolve({ id: ORIGINAL_ID }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledWith("operaciones");
    expect(eq).toHaveBeenCalledWith("id", ORIGINAL_ID);
    expect(eq).toHaveBeenCalledWith("tipo", "GASTO");
    expect(rpc).toHaveBeenCalledExactlyOnceWith("rpc_actualizar_movimiento_cuenta", {
      p_operacion_id: ORIGINAL_ID,
      p_cuenta_id: null,
      p_categoria_gasto: null,
      p_importe: null,
      p_descripcion: "Alquiler renegociado",
      p_fecha: null,
      p_idempotency_key: IDEMPOTENCY_KEY,
      p_observaciones: null,
      p_taller_id: null,
    });
    expect(body.data).toMatchObject({ id: ORIGINAL_ID, cuentaId: ACCOUNT_ID, descripcion: "Alquiler renegociado" });
    expect(statsService.onDataChanged).toHaveBeenCalledWith(expect.anything());
  });

  it.each([
    { observaciones: null, expected: "" },
    { observaciones: "Pagado con recargo", expected: "Pagado con recargo" },
  ])("envía observaciones=$observaciones como $expected para que la RPC la borre o reemplace", async ({ observaciones, expected }) => {
    const { maybeSingle, rpc } = mockSupabase(vi.fn().mockResolvedValue({ data: ORIGINAL_ID, error: null }));
    maybeSingle
      .mockResolvedValueOnce({ data: { ...gastoRow(), observaciones: "Observación anterior" }, error: null })
      .mockResolvedValueOnce({ data: { ...gastoRow(), observaciones: expected || null }, error: null });

    const request = new NextRequest(`http://localhost/api/gastos/${ORIGINAL_ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ observaciones, idempotencyKey: IDEMPOTENCY_KEY }),
    });
    const response = await PUT(request, { params: Promise.resolve({ id: ORIGINAL_ID }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("rpc_actualizar_movimiento_cuenta", expect.objectContaining({
      p_operacion_id: ORIGINAL_ID,
      p_observaciones: expected,
    }));
    expect(body.data.observaciones).toBe(expected || null);
  });

  it("carga la cuenta asociada al pago desde el detalle del gasto", async () => {
    const { maybeSingle, rpc } = mockSupabase();
    maybeSingle.mockResolvedValue({ data: gastoRow(), error: null });

    const response = await GET(new NextRequest(`http://localhost/api/gastos/${ORIGINAL_ID}`), {
      params: Promise.resolve({ id: ORIGINAL_ID }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { cuentaId: ACCOUNT_ID, cuentaNombre: "Caja principal" } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("permite editar un gasto con un pago parcial sin reenviar su cuenta", async () => {
    const { maybeSingle, rpc } = mockSupabase(vi.fn().mockResolvedValue({ data: ORIGINAL_ID, error: null }));
    const row = gastoRow();
    row.pagos[0].importe = -50000;
    maybeSingle.mockResolvedValue({ data: row, error: null });

    const response = await PUT(new NextRequest(`http://localhost/api/gastos/${ORIGINAL_ID}`, {
      method: "PUT",
      body: JSON.stringify({ cuentaId: ACCOUNT_ID, importe: row.monto_total, categoria: "SERVICIOS" }),
    }), { params: Promise.resolve({ id: ORIGINAL_ID }) });

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("rpc_actualizar_movimiento_cuenta", expect.objectContaining({
      p_cuenta_id: null,
      p_importe: null,
      p_categoria_gasto: "SERVICIOS",
    }));
    expect(await response.json()).toMatchObject({ data: { cuentaId: ACCOUNT_ID, puedeCambiarImporte: false } });
  });

  it("registra fallas de consulta en el servidor y devuelve 500", async () => {
    const logError = vi.spyOn(logger, "error").mockImplementation(() => {});
    const { maybeSingle, rpc } = mockSupabase();
    maybeSingle.mockResolvedValue({ data: null, error: { code: "XX000", message: "Falla de base" } });

    try {
      const response = await PUT(new NextRequest(`http://localhost/api/gastos/${ORIGINAL_ID}`, {
        method: "PUT",
        body: JSON.stringify({ descripcion: "Alquiler" }),
      }), { params: Promise.resolve({ id: ORIGINAL_ID }) });

      expect(response.status).toBe(500);
      expect(await response.json()).toMatchObject({ error: "Error actualizando gasto", errorId: expect.any(String) });
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining("PUT /api/gastos/[id]"),
        expect.objectContaining({ gastoId: ORIGINAL_ID, dbCode: "XX000" }),
        expect.any(Object),
      );
      expect(rpc).not.toHaveBeenCalled();
    } finally {
      logError.mockRestore();
    }
  });

  it("elimina el gasto via rpc_eliminar_movimiento_cuenta", async () => {
    const { rpc } = mockSupabase(vi.fn().mockResolvedValue({ data: true, error: null }));

    const response = await DELETE(
      new NextRequest(`http://localhost/api/gastos/${ORIGINAL_ID}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: ORIGINAL_ID }) }
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("rpc_eliminar_movimiento_cuenta", {
      p_operacion_id: ORIGINAL_ID,
    });
    expect(statsService.onDataChanged).toHaveBeenCalledWith(expect.anything());
  });
});


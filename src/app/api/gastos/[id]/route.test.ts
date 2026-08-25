import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { DELETE, PUT } from "./route";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/supabase/server";

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const ORIGINAL_ID = "22222222-2222-4222-8222-222222222222";
const IDEMPOTENCY_KEY = "44444444-4444-4444-8444-444444444444";

function gastoRow(id = ORIGINAL_ID, descripcion = "Alquiler original") {
  return {
    id,
    fecha: "2026-07-31T00:00:00.000Z",
    created_at: "2026-07-31T12:00:00.000Z",
    cuenta_financiera_id: ACCOUNT_ID,
    cuenta_financiera_nombre: "Caja principal",
    categoria_gasto: "ALQUILER",
    descripcion,
    monto: 150000,
    tipo: "GASTO",
  };
}

function mockSupabase(rpc: ReturnType<typeof vi.fn>) {
  return {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "token" } } }) },
    rpc,
  } as unknown as SupabaseClient;
}

describe("PUT /api/gastos/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("completa el patch con el gasto actual y devuelve el nuevo evento", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: [gastoRow()], error: null })
      .mockResolvedValueOnce({ data: ORIGINAL_ID, error: null })
      .mockResolvedValueOnce({ data: [gastoRow(ORIGINAL_ID, "Alquiler renegociado")], error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase(rpc));

    const request = new NextRequest(`http://localhost/api/gastos/${ORIGINAL_ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descripcion: "Alquiler renegociado", idempotencyKey: IDEMPOTENCY_KEY }),
    });
    const response = await PUT(request, { params: Promise.resolve({ id: ORIGINAL_ID }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenNthCalledWith(1, "rpc_listar_operaciones_con_gastos", {
      p_tipos: ["GASTO"],
      p_page: 1,
      p_page_size: 200,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "rpc_actualizar_movimiento_cuenta", {
      p_operacion_id: ORIGINAL_ID,
      p_cuenta_id: ACCOUNT_ID,
      p_categoria_gasto: "ALQUILER",
      p_importe: 150000,
      p_descripcion: "Alquiler renegociado",
      p_fecha: "2026-07-31T00:00:00.000Z",
      p_idempotency_key: IDEMPOTENCY_KEY,
    });
    expect(body.data).toMatchObject({ id: ORIGINAL_ID, descripcion: "Alquiler renegociado" });
  });

  it("elimina el gasto via rpc_eliminar_movimiento_cuenta", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase(rpc));

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
  });
});


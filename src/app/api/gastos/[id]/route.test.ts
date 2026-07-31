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
const UPDATED_ID = "33333333-3333-4333-8333-333333333333";
const IDEMPOTENCY_KEY = "44444444-4444-4444-8444-444444444444";

function gastoRow(id = ORIGINAL_ID, descripcion = "Alquiler original") {
  return {
    gasto_id: id,
    fecha: "2026-07-31T00:00:00.000Z",
    created_at: "2026-07-31T12:00:00.000Z",
    cuenta_financiera_id: ACCOUNT_ID,
    cuenta_financiera_nombre: "Caja principal",
    categoria_gasto: "ALQUILER",
    descripcion,
    importe: "150000",
    reversa_evento_id: null,
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
      .mockResolvedValueOnce({ data: UPDATED_ID, error: null })
      .mockResolvedValueOnce({ data: [gastoRow(UPDATED_ID, "Alquiler renegociado")], error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase(rpc));

    const request = new NextRequest(`http://localhost/api/gastos/${ORIGINAL_ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descripcion: "Alquiler renegociado", idempotencyKey: IDEMPOTENCY_KEY }),
    });
    const response = await PUT(request, { params: Promise.resolve({ id: ORIGINAL_ID }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenNthCalledWith(1, "rpc_finanzas_obtener_gasto", { p_gasto_id: ORIGINAL_ID });
    expect(rpc).toHaveBeenNthCalledWith(2, "rpc_finanzas_actualizar_gasto", {
      p_gasto_id: ORIGINAL_ID,
      p_cuenta_id: ACCOUNT_ID,
      p_categoria: "ALQUILER",
      p_importe: 150000,
      p_descripcion: "Alquiler renegociado",
      p_fecha: "2026-07-31T00:00:00.000Z",
      p_idempotency_key: IDEMPOTENCY_KEY,
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "rpc_finanzas_obtener_gasto", { p_gasto_id: UPDATED_ID });
    expect(body.data).toMatchObject({ id: UPDATED_ID, descripcion: "Alquiler renegociado" });
  });

  it("exige y reenvía una clave de idempotencia al anular", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: UPDATED_ID, error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase(rpc));

    const missingKey = await DELETE(
      new NextRequest(`http://localhost/api/gastos/${ORIGINAL_ID}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: ORIGINAL_ID }) }
    );
    expect(missingKey.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();

    const response = await DELETE(
      new NextRequest(`http://localhost/api/gastos/${ORIGINAL_ID}`, {
        method: "DELETE",
        headers: { "X-Idempotency-Key": IDEMPOTENCY_KEY },
      }),
      { params: Promise.resolve({ id: ORIGINAL_ID }) }
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("rpc_finanzas_eliminar_gasto", {
      p_gasto_id: ORIGINAL_ID,
      p_idempotency_key: IDEMPOTENCY_KEY,
    });
  });
});

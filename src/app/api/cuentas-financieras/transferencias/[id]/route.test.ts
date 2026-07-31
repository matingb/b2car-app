import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { DELETE, PUT } from "./route";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/supabase/server";

const ORIGIN_ID = "11111111-1111-4111-8111-111111111111";
const DESTINATION_ID = "22222222-2222-4222-8222-222222222222";
const ORIGINAL_ID = "33333333-3333-4333-8333-333333333333";
const UPDATED_ID = "44444444-4444-4444-8444-444444444444";
const IDEMPOTENCY_KEY = "55555555-5555-4555-8555-555555555555";

function transferenciaRow(id = ORIGINAL_ID, importe = "1000") {
  return {
    transferencia_id: id,
    fecha: "2026-07-31T00:00:00.000Z",
    created_at: "2026-07-31T12:00:00.000Z",
    descripcion: "Movimiento entre cajas",
    cuenta_origen_id: ORIGIN_ID,
    cuenta_origen_nombre: "Caja 1",
    cuenta_destino_id: DESTINATION_ID,
    cuenta_destino_nombre: "Caja 2",
    importe,
    reversa_evento_id: null,
  };
}

function mockSupabase(rpc: ReturnType<typeof vi.fn>) {
  return {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "token" } } }) },
    rpc,
  } as unknown as SupabaseClient;
}

describe("PUT /api/cuentas-financieras/transferencias/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reconstituye los campos requeridos y lee el nuevo evento de transferencia", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: [transferenciaRow()], error: null })
      .mockResolvedValueOnce({ data: UPDATED_ID, error: null })
      .mockResolvedValueOnce({ data: [transferenciaRow(UPDATED_ID, "1250")], error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase(rpc));

    const request = new NextRequest(`http://localhost/api/cuentas-financieras/transferencias/${ORIGINAL_ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ importe: 1250, idempotencyKey: IDEMPOTENCY_KEY }),
    });
    const response = await PUT(request, { params: Promise.resolve({ id: ORIGINAL_ID }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenNthCalledWith(1, "rpc_finanzas_obtener_transferencia", {
      p_transferencia_id: ORIGINAL_ID,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "rpc_finanzas_actualizar_transferencia", {
      p_transferencia_id: ORIGINAL_ID,
      p_cuenta_origen_id: ORIGIN_ID,
      p_cuenta_destino_id: DESTINATION_ID,
      p_importe: 1250,
      p_fecha: "2026-07-31T00:00:00.000Z",
      p_descripcion: "Movimiento entre cajas",
      p_idempotency_key: IDEMPOTENCY_KEY,
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "rpc_finanzas_obtener_transferencia", {
      p_transferencia_id: UPDATED_ID,
    });
    expect(body.data).toMatchObject({ id: UPDATED_ID, importe: 1250 });
  });

  it("exige y reenvía una clave de idempotencia al anular", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: UPDATED_ID, error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase(rpc));

    const missingKey = await DELETE(
      new NextRequest(`http://localhost/api/cuentas-financieras/transferencias/${ORIGINAL_ID}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: ORIGINAL_ID }) }
    );
    expect(missingKey.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();

    const response = await DELETE(
      new NextRequest(`http://localhost/api/cuentas-financieras/transferencias/${ORIGINAL_ID}`, {
        method: "DELETE",
        headers: { "X-Idempotency-Key": IDEMPOTENCY_KEY },
      }),
      { params: Promise.resolve({ id: ORIGINAL_ID }) }
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("rpc_finanzas_eliminar_transferencia", {
      p_transferencia_id: ORIGINAL_ID,
      p_idempotency_key: IDEMPOTENCY_KEY,
    });
  });
});

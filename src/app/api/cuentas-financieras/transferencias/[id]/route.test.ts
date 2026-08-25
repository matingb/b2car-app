import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { DELETE, PUT } from "./route";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/supabase/server";

const ORIGINAL_ID = "33333333-3333-4333-8333-333333333333";
const IDEMPOTENCY_KEY = "55555555-5555-4555-8555-555555555555";

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

  it("actualiza la transferencia via rpc_actualizar_movimiento_cuenta", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: ORIGINAL_ID, error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase(rpc));

    const request = new NextRequest(`http://localhost/api/cuentas-financieras/transferencias/${ORIGINAL_ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ importe: 1250, idempotencyKey: IDEMPOTENCY_KEY }),
    });
    const response = await PUT(request, { params: Promise.resolve({ id: ORIGINAL_ID }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("rpc_actualizar_movimiento_cuenta", {
      p_operacion_id: ORIGINAL_ID,
      p_cuenta_origen_id: null,
      p_cuenta_destino_id: null,
      p_importe: 1250,
      p_fecha: null,
      p_descripcion: null,
      p_idempotency_key: IDEMPOTENCY_KEY,
    });
    expect(body.data).toMatchObject({ id: ORIGINAL_ID, importe: 1250 });
  });

  it("elimina la transferencia via rpc_eliminar_movimiento_cuenta", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase(rpc));

    const response = await DELETE(
      new NextRequest(`http://localhost/api/cuentas-financieras/transferencias/${ORIGINAL_ID}`, {
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


import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { POST } from "./route";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/supabase/server";

const ORIGEN_ID = "11111111-1111-4111-8111-111111111111";
const DESTINO_ID = "22222222-2222-4222-8222-222222222222";
const TRANSFERENCIA_ID = "33333333-3333-4333-8333-333333333333";
const IDEMPOTENCY_KEY = "55555555-5555-4555-8555-555555555555";

function mockSupabase(rpc: ReturnType<typeof vi.fn>) {
  return {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "token" } } }) },
    rpc,
  } as unknown as SupabaseClient;
}

describe("POST /api/cuentas-financieras/transferencias", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registra la transferencia exitosamente", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: TRANSFERENCIA_ID, error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase(rpc));

    const request = new Request("http://localhost/api/cuentas-financieras/transferencias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cuentaOrigenId: ORIGEN_ID,
        cuentaDestinoId: DESTINO_ID,
        importe: 5000,
        fecha: "2026-08-24",
        descripcion: "Transferencia de prueba",
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("rpc_crear_movimiento_cuenta", {
      p_subtipo: "TRANSFERENCIA",
      p_importe: 5000,
      p_cuenta_origen_id: ORIGEN_ID,
      p_cuenta_destino_id: DESTINO_ID,
      p_descripcion: "Transferencia de prueba",
      p_fecha: expect.stringMatching(/^2026-08-24T/),
      p_idempotency_key: IDEMPOTENCY_KEY,
    });
    expect(body.data).toMatchObject({
      id: TRANSFERENCIA_ID,
      cuentaOrigenId: ORIGEN_ID,
      cuentaDestinoId: DESTINO_ID,
      importe: 5000,
    });
  });

  it("devuelve 400 si el payload es inválido (mismo origen y destino)", async () => {
    const rpc = vi.fn();
    vi.mocked(createClient).mockResolvedValue(mockSupabase(rpc));

    const request = new Request("http://localhost/api/cuentas-financieras/transferencias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cuentaOrigenId: ORIGEN_ID,
        cuentaDestinoId: ORIGEN_ID,
        importe: 5000,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("distintas");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("devuelve el error de RPC y status correspondiente cuando falla", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "22023", message: "importe debe ser un valor positivo mayor a cero" },
    });
    vi.mocked(createClient).mockResolvedValue(mockSupabase(rpc));

    const request = new Request("http://localhost/api/cuentas-financieras/transferencias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cuentaOrigenId: ORIGEN_ID,
        cuentaDestinoId: DESTINO_ID,
        importe: 100,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("importe debe ser un valor positivo mayor a cero");
  });
});

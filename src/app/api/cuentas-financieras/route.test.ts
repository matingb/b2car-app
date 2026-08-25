import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GET, POST } from "./route";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/supabase/server";

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";

function cuentaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ACCOUNT_ID,
    nombre: "Caja principal",
    tipo: "EFECTIVO",
    saldo_inicial: "2500.50",
    saldo: "2300.50",
    activo: true,
    created_at: "2026-07-31T12:00:00.000Z",
    updated_at: "2026-07-31T12:00:00.000Z",
    ...overrides,
  };
}

function mockSupabase(options: { session?: unknown; rpc?: ReturnType<typeof vi.fn> } = {}) {
  const session = Object.prototype.hasOwnProperty.call(options, "session")
    ? options.session
    : { access_token: "token" };
  return {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session } }) },
    rpc: options.rpc ?? vi.fn(),
  } as unknown as SupabaseClient;
}

describe("/api/cuentas-financieras", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requiere una sesión para listar", async () => {
    vi.mocked(createClient).mockResolvedValue(mockSupabase({ session: null }));

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ data: null, error: "Unauthorized" });
  });

  it("lista las cuentas mapeando el resultado de la RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [cuentaRow()], error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase({ rpc }));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("rpc_finanzas_listar_cuentas");
    expect(body.data).toEqual([
      expect.objectContaining({
        id: ACCOUNT_ID,
        tipo: "EFECTIVO",
        saldoInicial: 2500.5,
        saldoActual: 2300.5,
      }),
    ]);
  });

  it("rechaza un tipo de cuenta no permitido antes de invocar la RPC", async () => {
    const rpc = vi.fn();
    vi.mocked(createClient).mockResolvedValue(mockSupabase({ rpc }));
    const request = new Request("http://localhost/api/cuentas-financieras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Cuenta X", tipo: "OTRA" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("crea con los argumentos de la RPC y recupera la cuenta creada cuando retorna ID", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: ACCOUNT_ID, error: null })
      .mockResolvedValueOnce({ data: [cuentaRow()], error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase({ rpc }));
    const request = new Request("http://localhost/api/cuentas-financieras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Caja principal", tipo: "EFECTIVO", saldoInicial: 2500.5 }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenNthCalledWith(1, "rpc_finanzas_crear_cuenta", {
      p_nombre: "Caja principal",
      p_tipo: "EFECTIVO",
      p_saldo_inicial: 2500.5,
      p_fecha: null,
      p_idempotency_key: null,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "rpc_finanzas_obtener_cuenta", {
      p_cuenta_id: ACCOUNT_ID,
    });
    expect(body.data).toMatchObject({ id: ACCOUNT_ID, saldoActual: 2300.5 });
  });

  it("crea y retorna directamente la cuenta cuando la RPC devuelve la fila completa", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: [cuentaRow({ saldo_inicial: "1000", saldo: "1000" })], error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase({ rpc }));
    const request = new Request("http://localhost/api/cuentas-financieras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Caja principal", tipo: "EFECTIVO", saldoInicial: 1000 }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("rpc_finanzas_crear_cuenta", {
      p_nombre: "Caja principal",
      p_tipo: "EFECTIVO",
      p_saldo_inicial: 1000,
      p_fecha: null,
      p_idempotency_key: null,
    });
    expect(body.data).toMatchObject({
      id: ACCOUNT_ID,
      nombre: "Caja principal",
      tipo: "EFECTIVO",
      saldoInicial: 1000,
      saldoActual: 1000,
    });
  });
});


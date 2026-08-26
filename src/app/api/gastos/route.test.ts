import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GET, POST } from "./route";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/supabase/server";

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const EXPENSE_ID = "22222222-2222-4222-8222-222222222222";

function gastoRow(overrides: Record<string, unknown> = {}) {
  return {
    id: EXPENSE_ID,
    cuenta_financiera_id: ACCOUNT_ID,
    categoria_gasto: "ALQUILER",
    importe: "150000",
    fecha: "2026-07-31T00:00:00.000Z",
    descripcion: "Alquiler del taller",
    arreglo_id: null,
    operacion_id: null,
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

describe("/api/gastos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza un gasto sin descripción antes de invocar la RPC", async () => {
    const rpc = vi.fn();
    vi.mocked(createClient).mockResolvedValue(mockSupabase({ rpc }));
    const request = new Request("http://localhost/api/gastos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cuentaId: ACCOUNT_ID, categoria: "ALQUILER", importe: 150000 }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("registra un gasto con categoría y descripción requeridas", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: EXPENSE_ID, error: null })
      .mockResolvedValueOnce({ data: [gastoRow()], error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase({ rpc }));
    const request = new Request("http://localhost/api/gastos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cuentaId: ACCOUNT_ID,
        categoria: "ALQUILER",
        importe: 150000,
        fecha: "2026-07-31",
        descripcion: "Alquiler del taller",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenNthCalledWith(1, "rpc_crear_movimiento_cuenta", {
      p_subtipo: "GASTO",
      p_cuenta_id: ACCOUNT_ID,
      p_categoria_gasto: "ALQUILER",
      p_importe: 150000,
      p_fecha: expect.stringMatching(/^2026-07-31T/),
      p_descripcion: "Alquiler del taller",
      p_idempotency_key: null,
      p_arreglo_id: null,
    });
    expect(body.data).toMatchObject({
      id: EXPENSE_ID,
      cuentaId: ACCOUNT_ID,
      categoria: "ALQUILER",
      descripcion: "Alquiler del taller",
    });
  });

  it("valida los filtros de gastos antes de consultar", async () => {
    const rpc = vi.fn();
    vi.mocked(createClient).mockResolvedValue(mockSupabase({ rpc }));

    const response = await GET(new Request("http://localhost/api/gastos?limit=no-es-numero"));

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});

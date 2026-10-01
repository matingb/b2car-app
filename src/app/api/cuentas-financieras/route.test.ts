import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GET, POST } from "./route";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/permissions.server", () => ({
  fetchEffectivePermissions: vi.fn(), fetchPlanPermissions: vi.fn(),
}));

import { NextRequest } from "next/server";
import { createClient } from "@/supabase/server";
import { fetchEffectivePermissions } from "@/lib/permissions.server";
import { mockApiSession } from "@/tests/apiRoute";
import { logger } from "@/lib/logger";

const segment = () => ({ params: Promise.resolve({}) });
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

function mockSupabase(options: { rpc?: ReturnType<typeof vi.fn>; session?: unknown } = {}) {
  const supabase = { rpc: options.rpc ?? vi.fn() } as unknown as SupabaseClient;
  mockApiSession({ supabase, ...(options.session === null ? { claims: null } : {}) });
  return supabase;
}
describe("/api/cuentas-financieras", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiSession();
    vi.spyOn(logger, "warn").mockImplementation(() => {});
    vi.spyOn(logger, "error").mockImplementation(() => {});
  });

  it("requiere una sesión para listar", async () => {
    vi.mocked(createClient).mockResolvedValue(mockSupabase({ session: null }));

    const response = await GET(new NextRequest("http://localhost/api/cuentas-financieras"), segment());

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("lista las cuentas con saldos si tiene FinanzasView", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [cuentaRow()], error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase({ rpc }));

    const response = await GET(new NextRequest("http://localhost/api/cuentas-financieras"), segment());
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

  it("no ejecuta RPCs si falta FinanzasEdit", async () => {
    const rpc = vi.fn();
    mockApiSession({ supabase: { rpc } as unknown as SupabaseClient, permissions: [] });
    const request = new NextRequest("http://localhost/api/cuentas-financieras", { method: "POST", body: "{" });
    const read = vi.spyOn(request, "json");
    const response = await POST(request, segment());
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "FORBIDDEN" });
    expect(rpc).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it.each([
    { raw: "{", message: "JSON inválido" },
    { raw: "null", message: "JSON inválido" },
    { raw: '{"nombre":" ","tipo":"EFECTIVO"}', message: "Falta nombre" },
  ])("rechaza un body inválido antes de invocar la RPC: $message", async ({ raw, message }) => {
    const rpc = vi.fn();
    mockApiSession({ supabase: { rpc } as unknown as SupabaseClient });
    const request = new NextRequest("http://localhost/api/cuentas-financieras", { method: "POST", body: raw });
    const read = vi.spyOn(request, "json");
    const response = await POST(request, segment());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: message, code: "VALIDATION" });
    expect(read).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("mapea errores de RPC y conserva el mensaje de negocio", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "22023", message: "El saldo inicial no puede ser negativo" } });
    mockApiSession({ supabase: { rpc } as unknown as SupabaseClient });
    const response = await POST(new NextRequest("http://localhost/api/cuentas-financieras", {
      method: "POST", body: JSON.stringify({ nombre: "Caja", tipo: "EFECTIVO" }),
    }), segment());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "El saldo inicial no puede ser negativo", code: "VALIDATION" });
  });

  it("retorna una referencia para errores internos de listado", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "XX000", message: "private table" } });
    const { getClaims } = mockApiSession({ supabase: { rpc } as unknown as SupabaseClient });
    const response = await GET(new NextRequest("http://localhost/api/cuentas-financieras"), segment());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Error listando cuentas financieras", code: "INTERNAL", errorId: expect.any(String) });
    expect(getClaims).toHaveBeenCalledTimes(1);
  });

  it("oculta saldos (0) si el usuario no tiene FinanzasView", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [cuentaRow()], error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase({ rpc }));
    vi.mocked(fetchEffectivePermissions).mockResolvedValueOnce([]);

    const response = await GET(new NextRequest("http://localhost/api/cuentas-financieras"), segment());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([
      expect.objectContaining({
        id: ACCOUNT_ID,
        tipo: "EFECTIVO",
        saldoInicial: 0,
        saldoActual: 0,
      }),
    ]);
  });

  it("rechaza un tipo de cuenta no permitido antes de invocar la RPC", async () => {
    const rpc = vi.fn();
    vi.mocked(createClient).mockResolvedValue(mockSupabase({ rpc }));
    const request = new NextRequest("http://localhost/api/cuentas-financieras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Cuenta X", tipo: "OTRA" }),
    });

    const response = await POST(request, segment());

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("crea con los argumentos de la RPC y recupera la cuenta creada cuando retorna ID", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: ACCOUNT_ID, error: null })
      .mockResolvedValueOnce({ data: [cuentaRow()], error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase({ rpc }));
    const request = new NextRequest("http://localhost/api/cuentas-financieras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Caja principal", tipo: "EFECTIVO", saldoInicial: 2500.5 }),
    });

    const response = await POST(request, segment());
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
    const request = new NextRequest("http://localhost/api/cuentas-financieras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Caja principal", tipo: "EFECTIVO", saldoInicial: 1000 }),
    });

    const response = await POST(request, segment());
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


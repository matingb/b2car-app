import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { GET, PUT, DELETE } from "./route";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/requirePermission", () => ({
  requirePermission: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/permissions.server", () => ({
  hasUserPermission: vi.fn().mockResolvedValue(true),
}));

import { createClient } from "@/supabase/server";
import { requirePermission } from "@/lib/requirePermission";
import { hasUserPermission } from "@/lib/permissions.server";

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
  const session = options.session === undefined ? { access_token: "token" } : options.session;
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session } }),
      getClaims: vi.fn().mockResolvedValue({
        data: session ? { claims: { user_role: "admin", plan_sub: "PRO" } } : null,
        error: session ? null : new Error("No session"),
      }),
    },
    rpc: options.rpc ?? vi.fn(),
  } as unknown as SupabaseClient;
}

describe("/api/cuentas-financieras/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermission).mockResolvedValue(null);
    vi.mocked(hasUserPermission).mockResolvedValue(true);
  });

  it("GET requiere una sesión", async () => {
    vi.mocked(createClient).mockResolvedValue(mockSupabase({ session: null }));

    const req = new NextRequest(`http://localhost/api/cuentas-financieras/${ACCOUNT_ID}`);
    const response = await GET(req, { params: Promise.resolve({ id: ACCOUNT_ID }) });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ data: null, error: "Unauthorized" });
  });

  it("GET valida formato de UUID", async () => {
    vi.mocked(createClient).mockResolvedValue(mockSupabase());

    const req = new NextRequest("http://localhost/api/cuentas-financieras/invalid-uuid");
    const response = await GET(req, { params: Promise.resolve({ id: "invalid-uuid" }) });

    expect(response.status).toBe(400);
  });

  it("GET devuelve 404 si la cuenta no existe", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase({ rpc }));

    const req = new NextRequest(`http://localhost/api/cuentas-financieras/${ACCOUNT_ID}`);
    const response = await GET(req, { params: Promise.resolve({ id: ACCOUNT_ID }) });

    expect(response.status).toBe(404);
  });

  it("GET devuelve saldos reales si el usuario tiene FinanzasView", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [cuentaRow()], error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase({ rpc }));

    const req = new NextRequest(`http://localhost/api/cuentas-financieras/${ACCOUNT_ID}`);
    const response = await GET(req, { params: Promise.resolve({ id: ACCOUNT_ID }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      id: ACCOUNT_ID,
      saldoInicial: 2500.5,
      saldoActual: 2300.5,
    });
  });

  it("GET oculta saldos (0) si el usuario no tiene FinanzasView", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [cuentaRow()], error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase({ rpc }));
    vi.mocked(hasUserPermission).mockResolvedValueOnce(false);

    const req = new NextRequest(`http://localhost/api/cuentas-financieras/${ACCOUNT_ID}`);
    const response = await GET(req, { params: Promise.resolve({ id: ACCOUNT_ID }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      id: ACCOUNT_ID,
      saldoInicial: 0,
      saldoActual: 0,
    });
  });

  it("PUT requiere permiso FinanzasEdit", async () => {
    vi.mocked(requirePermission).mockResolvedValueOnce(
      Response.json({ error: "FORBIDDEN_INSUFFICIENT_PERMISSIONS" }, { status: 403 })
    );

    const req = new NextRequest(`http://localhost/api/cuentas-financieras/${ACCOUNT_ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Nuevo nombre" }),
    });
    const response = await PUT(req, { params: Promise.resolve({ id: ACCOUNT_ID }) });

    expect(response.status).toBe(403);
  });

  it("PUT actualiza y devuelve la cuenta", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [cuentaRow({ nombre: "Nuevo nombre" })], error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase({ rpc }));

    const req = new NextRequest(`http://localhost/api/cuentas-financieras/${ACCOUNT_ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Nuevo nombre" }),
    });
    const response = await PUT(req, { params: Promise.resolve({ id: ACCOUNT_ID }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data?.nombre).toBe("Nuevo nombre");
  });

  it("DELETE requiere permiso FinanzasEdit", async () => {
    vi.mocked(requirePermission).mockResolvedValueOnce(
      Response.json({ error: "FORBIDDEN_INSUFFICIENT_PERMISSIONS" }, { status: 403 })
    );

    const req = new NextRequest(`http://localhost/api/cuentas-financieras/${ACCOUNT_ID}`, {
      method: "DELETE",
    });
    const response = await DELETE(req, { params: Promise.resolve({ id: ACCOUNT_ID }) });

    expect(response.status).toBe(403);
  });

  it("DELETE elimina y devuelve 200", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase({ rpc }));

    const req = new NextRequest(`http://localhost/api/cuentas-financieras/${ACCOUNT_ID}`, {
      method: "DELETE",
    });
    const response = await DELETE(req, { params: Promise.resolve({ id: ACCOUNT_ID }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ error: null });
  });
});

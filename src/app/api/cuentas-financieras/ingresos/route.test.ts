import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { POST } from "./route";

vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/requirePermission", () => ({ requirePermission: vi.fn().mockResolvedValue(null) }));
vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: { onDataChanged: vi.fn().mockResolvedValue(undefined) },
}));

import { createClient } from "@/supabase/server";
import { requirePermission } from "@/lib/requirePermission";
import { Permission } from "@/lib/permissions";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";

const CUENTA_ID = "11111111-1111-4111-8111-111111111111";
const INGRESO_ID = "33333333-3333-4333-8333-333333333333";
const IDEMPOTENCY_KEY = "55555555-5555-4555-8555-555555555555";
const FECHA = "2026-09-24T23:55:00-03:00";

function mockSupabase(rpc: ReturnType<typeof vi.fn>) {
  return {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "token" } } }) },
    rpc,
  } as unknown as SupabaseClient;
}

function makeRequest(payload: unknown) {
  return new Request("http://localhost/api/cuentas-financieras/ingresos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/cuentas-financieras/ingresos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermission).mockResolvedValue(null);
  });

  it("crea el ingreso manual sin origen de negocio, envía idempotencia e invalida estadísticas", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: INGRESO_ID, error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase(rpc));

    const response = await POST(makeRequest({
      cuentaId: CUENTA_ID,
      importe: 1250.5,
      fecha: FECHA,
      descripcion: "Aporte de capital",
      idempotencyKey: IDEMPOTENCY_KEY,
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("rpc_crear_movimiento_cuenta", {
      p_subtipo: "INGRESO",
      p_cuenta_id: CUENTA_ID,
      p_importe: 1250.5,
      p_fecha: FECHA,
      p_descripcion: "Aporte de capital",
      p_idempotency_key: IDEMPOTENCY_KEY,
    });
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
    expect(body.data).toMatchObject({
      id: INGRESO_ID,
      cuentaId: CUENTA_ID,
      importe: 1250.5,
      fecha: FECHA,
      descripcion: "Aporte de capital",
    });
  });

  it("rechaza campos faltantes o importes con fracciones de centavo antes de llamar a la RPC", async () => {
    const rpc = vi.fn();
    vi.mocked(createClient).mockResolvedValue(mockSupabase(rpc));

    for (const payload of [
      { cuentaId: CUENTA_ID, importe: 10, fecha: FECHA },
      { cuentaId: CUENTA_ID, importe: 10.001, fecha: FECHA, descripcion: "Concepto" },
    ]) {
      const response = await POST(makeRequest(payload));
      expect(response.status).toBe(400);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("mapea cuenta inexistente o ajena al tenant como no encontrada", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "P0002", message: "internal account details" } });
    vi.mocked(createClient).mockResolvedValue(mockSupabase(rpc));

    const response = await POST(makeRequest({
      cuentaId: CUENTA_ID,
      importe: 10,
      fecha: FECHA,
      descripcion: "Concepto",
      idempotencyKey: IDEMPOTENCY_KEY,
    }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).not.toContain("internal account details");
  });

  it("exige FinanzasEdit antes de ejecutar la RPC", async () => {
    const rpc = vi.fn();
    vi.mocked(createClient).mockResolvedValue(mockSupabase(rpc));
    vi.mocked(requirePermission).mockResolvedValueOnce(Response.json({ error: "Forbidden" }, { status: 403 }));

    const response = await POST(makeRequest({}));

    expect(response.status).toBe(403);
    expect(requirePermission).toHaveBeenCalledWith(Permission.FinanzasEdit);
    expect(rpc).not.toHaveBeenCalled();
  });
});

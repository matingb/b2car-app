import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DELETE, POST } from "./route";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: {
    onDataChanged: vi.fn(),
  },
}));

import { createClient } from "@/supabase/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";

const ARREGLO_ID = "11111111-1111-4111-8111-111111111111";
const CUENTA_ID = "22222222-2222-4222-8222-222222222222";
const IDEMPOTENCY_KEY = "33333333-3333-4333-8333-333333333333";

const arreglo = {
  id: ARREGLO_ID,
  tenant_id: "44444444-4444-4444-8444-444444444444",
  esta_pago: true,
  precio_final: 25000,
};

function mockSupabase(rpc: ReturnType<typeof vi.fn>) {
  return {
    rpc,
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: arreglo, error: null }),
        })),
      })),
    })),
  } as unknown as SupabaseClient;
}

describe("/api/arreglos/[id]/cobro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registra el cobro con cuenta, fecha e idempotencia y rehidrata el arreglo", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "evento-id", error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase(rpc));

    const response = await POST(
      new NextRequest(`http://localhost/api/arreglos/${ARREGLO_ID}/cobro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cuenta_financiera_id: CUENTA_ID,
          fecha_cobro: "2026-07-31",
          idempotency_key: IDEMPOTENCY_KEY,
        }),
      }),
      { params: Promise.resolve({ id: ARREGLO_ID }) }
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("rpc_finanzas_cobrar_arreglo", {
      p_arreglo_id: ARREGLO_ID,
      p_cuenta_id: CUENTA_ID,
      p_fecha_cobro: "2026-07-31",
      p_idempotency_key: IDEMPOTENCY_KEY,
    });
    expect(statsService.onDataChanged).toHaveBeenCalledWith(expect.anything(), arreglo.tenant_id);
    await expect(response.json()).resolves.toMatchObject({ data: { id: ARREGLO_ID } });
  });

  it("exige idempotencia al anular y la entrega al RPC de reverso", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "reverso-id", error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase(rpc));

    const missingKey = await DELETE(
      new NextRequest(`http://localhost/api/arreglos/${ARREGLO_ID}/cobro`, { method: "DELETE" }),
      { params: Promise.resolve({ id: ARREGLO_ID }) }
    );
    expect(missingKey.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();

    const response = await DELETE(
      new NextRequest(`http://localhost/api/arreglos/${ARREGLO_ID}/cobro`, {
        method: "DELETE",
        headers: { "X-Idempotency-Key": IDEMPOTENCY_KEY },
      }),
      { params: Promise.resolve({ id: ARREGLO_ID }) }
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("rpc_finanzas_anular_cobro_arreglo", {
      p_arreglo_id: ARREGLO_ID,
      p_idempotency_key: IDEMPOTENCY_KEY,
    });
  });
});

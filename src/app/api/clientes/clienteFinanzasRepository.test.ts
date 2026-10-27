import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clienteFinanzasRepository } from "./clienteFinanzasRepository";

describe("clienteFinanzasRepository", () => {
  it("getResumenFinanciero invoca la RPC rpc_cliente_resumen_financiero", async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: { saldo_cuenta: 100 }, error: null });
    const db = { rpc: mockRpc } as unknown as SupabaseClient;

    const res = await clienteFinanzasRepository.getResumenFinanciero(db, "cli-1");

    expect(mockRpc).toHaveBeenCalledWith("rpc_cliente_resumen_financiero", { p_cliente_id: "cli-1" });
    expect(res.data).toEqual({ saldo_cuenta: 100 });
  });

  it("getCuentaCorriente invoca la RPC rpc_cliente_cuenta_corriente con filtros de fecha", async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const db = { rpc: mockRpc } as unknown as SupabaseClient;

    const res = await clienteFinanzasRepository.getCuentaCorriente(db, "cli-1", {
      from: "2026-01-01",
      to: "2026-01-31",
    });

    expect(mockRpc).toHaveBeenCalledWith("rpc_cliente_cuenta_corriente", {
      p_cliente_id: "cli-1",
      p_from: "2026-01-01",
      p_to: "2026-01-31",
    });
    expect(res.data).toEqual([]);
  });

  it("getSaldos invoca la RPC rpc_clientes_saldos con los IDs provistos", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: [{ cliente_id: "cli-1", saldo: 500 }],
      error: null,
    });
    const db = { rpc: mockRpc } as unknown as SupabaseClient;

    const res = await clienteFinanzasRepository.getSaldos(db, ["cli-1", "cli-2"]);

    expect(mockRpc).toHaveBeenCalledWith("rpc_clientes_saldos", {
      p_cliente_ids: ["cli-1", "cli-2"],
    });
    expect(res.data).toEqual([{ cliente_id: "cli-1", saldo: 500 }]);
  });

  it("getSaldos pasa null cuando no se envían clienteIds", async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const db = { rpc: mockRpc } as unknown as SupabaseClient;

    await clienteFinanzasRepository.getSaldos(db);

    expect(mockRpc).toHaveBeenCalledWith("rpc_clientes_saldos", {
      p_cliente_ids: null,
    });
  });
});

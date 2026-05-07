import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { createClient } from "@/supabase/server";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("POST /api/arreglos/[id]/repuestos", () => {
  const rpc = vi.fn();
  const mockSupabase = { rpc } as unknown as Awaited<ReturnType<typeof createClient>>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabase);
  });

  it("agrega o edita un repuesto existente sin invalidar stats", async () => {
    rpc.mockResolvedValue({ data: "OP-1", error: null });

    const req = new Request("http://localhost/api/arreglos/A-1/repuestos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taller_id: "T-1",
        stock_id: "S-1",
        cantidad: 2,
        monto_unitario: 1500,
      }),
    });

    const res = await POST(req as never, {
      params: Promise.resolve({ id: "A-1" }),
    });

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("rpc_set_asignacion_arreglo_linea", {
      p_arreglo_id: "A-1",
      p_taller_id: "T-1",
      p_stock_id: "S-1",
      p_cantidad: 2,
      p_monto_unitario: 1500,
    });
    await expect(res.json()).resolves.toEqual({
      data: { operacion_id: "OP-1" },
      error: null,
    });
  });

  it("no invalida stats si falla la RPC", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "STOCK_INSUFICIENTE" } });

    const req = new Request("http://localhost/api/arreglos/A-1/repuestos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taller_id: "T-1",
        stock_id: "S-1",
        cantidad: 2,
        monto_unitario: 1500,
      }),
    });

    const res = await POST(req as never, {
      params: Promise.resolve({ id: "A-1" }),
    });

    expect(res.status).toBe(409);
  });

  it("crea producto inline y asigna el repuesto usando el mismo POST", async () => {
    rpc.mockResolvedValue({ data: "OP-2", error: null });

    const req = new Request("http://localhost/api/arreglos/A-1/repuestos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "nuevo",
        taller_id: "T-1",
        codigo: "FILT-1",
        nombre: "Filtro",
        precio_compra: 100,
        precio_venta: 180,
        cantidad: 2,
      }),
    });

    const res = await POST(req as never, {
      params: Promise.resolve({ id: "A-1" }),
    });

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("rpc_crear_producto_inline_para_arreglo", {
      p_arreglo_id: "A-1",
      p_taller_id: "T-1",
      p_codigo: "FILT-1",
      p_nombre: "Filtro",
      p_precio_compra: 100,
      p_precio_venta: 180,
      p_cantidad: 2,
    });
    await expect(res.json()).resolves.toEqual({
      data: { operacion_id: "OP-2" },
      error: null,
    });
  });

  it("mapea codigo duplicado al crear producto inline", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "PRODUCTO_CODIGO_DUPLICADO" },
    });

    const req = new Request("http://localhost/api/arreglos/A-1/repuestos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "nuevo",
        taller_id: "T-1",
        codigo: "FILT-1",
        nombre: "Filtro",
        precio_compra: 100,
        precio_venta: 180,
        cantidad: 2,
      }),
    });

    const res = await POST(req as never, {
      params: Promise.resolve({ id: "A-1" }),
    });

    expect(res.status).toBe(409);
  });
});

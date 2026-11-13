import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseProductoRepository } from "./productoRepository";
import { ServiceError } from "@/app/api/serviceError";

describe("supabaseProductoRepository", () => {
  it("list consulta productos y stocks y los mapea correctamente", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "p1",
                nombre: "Aceite",
                stocks: [{ id: "s1", cantidad: 10 }],
              },
              {
                id: "p2",
                nombre: "Filtro",
                stocks: null,
              },
            ],
            error: null,
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const res = await supabaseProductoRepository.list(supabase);

    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(2);
    expect(res.data[0].talleresConStock).toBe(1);
    expect(res.data[1].talleresConStock).toBe(0);
    expect(res.data[1].stocks).toEqual([]);
  });

  it("getById consulta por id", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "p1", nombre: "Batería" },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const supabase = { from } as unknown as SupabaseClient;

    const res = await supabaseProductoRepository.getById(supabase, "p1");

    expect(res.error).toBeNull();
    expect(res.data?.id).toBe("p1");
    expect(from).toHaveBeenCalledWith("productos");
    expect(eq).toHaveBeenCalledWith("id", "p1");
  });

  it("getStocksByProductoId consulta la tabla stocks", async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [{ id: "s1", producto_id: "p1", cantidad: 10 }],
      error: null,
    });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const supabase = { from } as unknown as SupabaseClient;

    const res = await supabaseProductoRepository.getStocksByProductoId(supabase, "p1");

    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(1);
    expect(from).toHaveBeenCalledWith("stocks");
    expect(eq).toHaveBeenCalledWith("producto_id", "p1");
  });

  it("create inserta y retorna producto", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: "p1", nombre: "Líquido de frenos" },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    const supabase = { from } as unknown as SupabaseClient;

    const payload = {
      codigo: "LIQ-01",
      nombre: "Líquido de frenos",
      marca: "Dot4",
      modelo: null,
      descripcion: null,
      precio_unitario: 50,
      costo_unitario: 30,
      categorias: ["Frenos"],
      show_in_stock: true,
    };

    const res = await supabaseProductoRepository.create(supabase, payload);

    expect(res.error).toBeNull();
    expect(res.data?.id).toBe("p1");
    expect(insert).toHaveBeenCalledWith([payload]);
  });

  it("updateById actualiza por id", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "p1", nombre: "Nombre Actualizado" },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    const supabase = { from } as unknown as SupabaseClient;

    const res = await supabaseProductoRepository.updateById(supabase, "p1", { nombre: "Nombre Actualizado" });

    expect(res.error).toBeNull();
    expect(res.data?.nombre).toBe("Nombre Actualizado");
    expect(update).toHaveBeenCalledWith({ nombre: "Nombre Actualizado" });
    expect(eq).toHaveBeenCalledWith("id", "p1");
  });

  describe("deleteById", () => {
    it("elimina stocks y producto correctamente", async () => {
      const from = vi.fn((table: string) => ({
        delete: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue(
            table === "productos" ? { error: null, count: 1 } : { error: null }
          ),
        })),
      }));
      const supabase = { from } as unknown as SupabaseClient;

      const res = await supabaseProductoRepository.deleteById(supabase, "p1");
      expect(res.error).toBeNull();
      expect(from).toHaveBeenCalledWith("stocks");
      expect(from).toHaveBeenCalledWith("productos");
    });

    it("retorna error si falla el borrado de stocks", async () => {
      const from = vi.fn((table: string) => ({
        delete: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue(
            table === "stocks"
              ? { error: { code: "23503", message: "fk violation" } }
              : { error: null, count: 1 }
          ),
        })),
      }));
      const supabase = { from } as unknown as SupabaseClient;

      const res = await supabaseProductoRepository.deleteById(supabase, "p1");
      expect(res.error).toBe(ServiceError.EnUso);
    });

    it("retorna NotFound si count es 0", async () => {
      const from = vi.fn((table: string) => ({
        delete: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue(
            table === "stocks" ? { error: null } : { error: null, count: 0 }
          ),
        })),
      }));
      const supabase = { from } as unknown as SupabaseClient;

      const res = await supabaseProductoRepository.deleteById(supabase, "p1");
      expect(res.error).toBe(ServiceError.NotFound);
    });
  });
});

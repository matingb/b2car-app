import { describe, it, expect, vi } from "vitest";
import { supabaseProveedorRepository } from "./proveedorRepository";
import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import { ServiceError } from "@/app/api/serviceError";

function createQueryChain(resolvedValue: { data: unknown; error: unknown; count?: number | null }) {
  const chain: Record<string, unknown> = {};
  for (const m of [
    "select",
    "order",
    "limit",
    "or",
    "eq",
    "in",
    "insert",
    "update",
    "delete",
    "single",
    "maybeSingle",
  ]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (
    onFulfilled: (v: unknown) => unknown,
    onRejected?: (e: unknown) => unknown
  ) => Promise.resolve(resolvedValue).then(onFulfilled, onRejected);
  return chain;
}

function makeSupabase(resolvedValue: { data: unknown; error: unknown; count?: number | null }) {
  const chain = createQueryChain(resolvedValue);
  const supabase = {
    from: vi.fn().mockReturnValue(chain),
    __chain: chain,
  };
  return supabase as unknown as SupabaseClient & {
    __chain: ReturnType<typeof createQueryChain>;
  };
}

const mockPgError = (code = "23505"): PostgrestError => ({
  name: "PostgrestError",
  code,
  message: "violates unique constraint",
  details: "",
  hint: "",
});

describe("supabaseProveedorRepository", () => {
  describe("list", () => {
    it("debe listar proveedores ordenados por nombre", async () => {
      const mockData = [
        { id: "1", nombre: "A" },
        { id: "2", nombre: "B" },
      ];
      const supabase = makeSupabase({ data: mockData, error: null });

      const res = await supabaseProveedorRepository.list(supabase);

      expect(supabase.from).toHaveBeenCalledWith("proveedores");
      expect(supabase.__chain.select).toHaveBeenCalledWith("*");
      expect(supabase.__chain.order).toHaveBeenCalledWith("nombre", { ascending: true });
      expect(res.data).toEqual(mockData);
      expect(res.error).toBeNull();
    });

    it("debe aplicar filtro de búsqueda en nombre o cuit y límite", async () => {
      const supabase = makeSupabase({ data: [], error: null });

      await supabaseProveedorRepository.list(supabase, { search: "norte", limit: 25 });

      expect(supabase.__chain.or).toHaveBeenCalledWith("nombre.ilike.%norte%,cuit.ilike.%norte%");
      expect(supabase.__chain.limit).toHaveBeenCalledWith(25);
    });

    it("retorna error cuando la consulta a base de datos falla", async () => {
      const error = mockPgError("50000");
      const supabase = makeSupabase({ data: null, error });

      const res = await supabaseProveedorRepository.list(supabase);

      expect(res.data).toEqual([]);
      expect(res.error).toEqual(ServiceError.Unknown);
    });
  });

  describe("getById", () => {
    it("obtiene un proveedor por ID", async () => {
      const mockData = { id: "p-1", nombre: "Distribuidora" };
      const supabase = makeSupabase({ data: mockData, error: null });

      const res = await supabaseProveedorRepository.getById(supabase, "p-1");

      expect(supabase.__chain.eq).toHaveBeenCalledWith("id", "p-1");
      expect(supabase.__chain.maybeSingle).toHaveBeenCalled();
      expect(res.data).toEqual(mockData);
      expect(res.error).toBeNull();
    });

    it("retorna NotFound si el proveedor no existe", async () => {
      const supabase = makeSupabase({ data: null, error: null });

      const res = await supabaseProveedorRepository.getById(supabase, "p-999");

      expect(res.data).toBeNull();
      expect(res.error).toBe(ServiceError.NotFound);
    });
  });

  describe("create", () => {
    it("inserta un proveedor y devuelve el registro creado", async () => {
      const payload = {
        nombre: "Distribuidora Norte",
        cuit: "30-71234567-8",
        telefono: "123456",
        email: "test@test.com",
        direccion: "Calle 1",
      };
      const createdRow = { id: "new-id", ...payload };
      const supabase = makeSupabase({ data: createdRow, error: null });

      const res = await supabaseProveedorRepository.create(supabase, payload);

      expect(supabase.__chain.insert).toHaveBeenCalledWith([payload]);
      expect(res.data).toEqual(createdRow);
      expect(res.error).toBeNull();
    });

    it("retorna Conflict cuando el cuit ya existe", async () => {
      const payload = {
        nombre: "Duplicado",
        cuit: "30-71234567-8",
        telefono: null,
        email: null,
        direccion: null,
      };
      const supabase = makeSupabase({ data: null, error: mockPgError("23505") });

      const res = await supabaseProveedorRepository.create(supabase, payload);

      expect(res.data).toBeNull();
      expect(res.error).toBe(ServiceError.Conflict);
    });
  });

  describe("updateById", () => {
    it("actualiza un proveedor existente", async () => {
      const patch = { nombre: "Nombre Actualizado" };
      const updatedRow = { id: "p-1", nombre: "Nombre Actualizado" };
      const supabase = makeSupabase({ data: updatedRow, error: null });

      const res = await supabaseProveedorRepository.updateById(supabase, "p-1", patch);

      expect(supabase.__chain.update).toHaveBeenCalledWith(patch);
      expect(supabase.__chain.eq).toHaveBeenCalledWith("id", "p-1");
      expect(res.data).toEqual(updatedRow);
      expect(res.error).toBeNull();
    });

    it("retorna NotFound si no existe para actualizar", async () => {
      const supabase = makeSupabase({ data: null, error: null });

      const res = await supabaseProveedorRepository.updateById(supabase, "p-999", { nombre: "A" });

      expect(res.data).toBeNull();
      expect(res.error).toBe(ServiceError.NotFound);
    });
  });

  describe("deleteById", () => {
    it("elimina un proveedor por ID", async () => {
      const supabase = makeSupabase({ data: null, error: null, count: 1 });

      const res = await supabaseProveedorRepository.deleteById(supabase, "p-1");

      expect(supabase.__chain.delete).toHaveBeenCalledWith({ count: "exact" });
      expect(supabase.__chain.eq).toHaveBeenCalledWith("id", "p-1");
      expect(res.error).toBeNull();
    });

    it("retorna NotFound si count es 0", async () => {
      const supabase = makeSupabase({ data: null, error: null, count: 0 });

      const res = await supabaseProveedorRepository.deleteById(supabase, "p-999");

      expect(res.error).toBe(ServiceError.NotFound);
    });
  });

  describe("getCuentaCorriente", () => {
    it("obtiene operaciones y calcula acumulados", async () => {
      const mockOperaciones = [
        {
          id: "op-1",
          tipo: "COMPRA",
          fecha: "2026-10-21T00:00:00Z",
          created_at: "2026-10-21T00:00:00Z",
          monto_total: 10000,
          total_pagado: 4000,
          estado_pago: "PARCIAL",
          estado_stock: "ENTREGADO",
          observaciones: "Compra 1",
          taller_id: "t-1",
          talleres: { nombre: "Taller A" },
        },
      ];

      const supabase = makeSupabase({ data: mockOperaciones, error: null });

      const res = await supabaseProveedorRepository.getCuentaCorriente(supabase, "prov-1");

      expect(supabase.from).toHaveBeenCalledWith("operaciones_compra");
      expect(res.error).toBeNull();
      expect(res.data?.totalComprado).toBe(10000);
      expect(res.data?.totalPagado).toBe(4000);
      expect(res.data?.saldoAdeudado).toBe(6000);
      expect(res.data?.operaciones[0].taller_nombre).toBe("Taller A");
      expect(res.data?.operaciones[0].lineas).toEqual([]);
    });

    it("mapea operaciones_lineas enriquecidas con productos de stock", async () => {
      const mockOperaciones = [
        {
          id: "op-2",
          tipo: "COMPRA",
          fecha: "2026-10-22T00:00:00Z",
          created_at: "2026-10-22T00:00:00Z",
          monto_total: 5000,
          total_pagado: 5000,
          estado_pago: "PAGADO",
          estado_stock: "ENTREGADO",
          observaciones: null,
          taller_id: "t-1",
          talleres: { nombre: "Taller A" },
          operaciones_lineas: [
            {
              id: "lin-1",
              stock_id: "stk-1",
              cantidad: 2,
              cantidad_cumplida: 2,
              monto_unitario: 2500,
              delta_cantidad: 2,
              created_at: "2026-10-22T00:00:00Z",
              stocks: {
                producto_id: "prod-1",
                productos: {
                  nombre: "Filtro de Aceite",
                  codigo: "FLT-001",
                },
              },
            },
          ],
        },
      ];

      const supabase = makeSupabase({ data: mockOperaciones, error: null });
      const res = await supabaseProveedorRepository.getCuentaCorriente(supabase, "prov-1");

      expect(res.data?.operaciones[0].lineas).toEqual([
        {
          id: "lin-1",
          operacion_id: "op-2",
          stock_id: "stk-1",
          cantidad: 2,
          cantidad_cumplida: 2,
          monto_unitario: 2500,
          delta_cantidad: 2,
          created_at: "2026-10-22T00:00:00Z",
          nombre: "Filtro de Aceite",
          codigo: "FLT-001",
        },
      ]);
    });
  });

  describe("getSaldos", () => {
    it("calcula saldos pendientes agrupados por proveedor", async () => {
      const mockCompras = [
        {
          proveedor_id: "prov-1",
          operaciones: { id: "op-1", monto_total: 100000, total_pagado: 40000 },
        },
        {
          proveedor_id: "prov-1",
          operaciones: { id: "op-2", monto_total: 50000, total_pagado: 50000 },
        },
        {
          proveedor_id: "prov-2",
          operaciones: { id: "op-3", monto_total: 80000, total_pagado: 80000 },
        },
      ];

      const supabase = makeSupabase({ data: mockCompras, error: null });
      const res = await supabaseProveedorRepository.getSaldos(supabase, ["prov-1", "prov-2"]);

      expect(supabase.from).toHaveBeenCalledWith("operaciones_compra");
      expect(supabase.__chain.in).toHaveBeenCalledWith("proveedor_id", ["prov-1", "prov-2"]);
      expect(res.data.get("prov-1")?.saldoPendiente).toBe(60000);
      expect(res.data.get("prov-2")?.saldoPendiente).toBe(0);
      expect(res.error).toBeNull();
    });
  });
});

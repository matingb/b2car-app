import { describe, expect, it } from "vitest";
import type { RepuestoDraft, RepuestoLinea } from "./RepuestoLineasEditableSection";
import {
  NEW_PRODUCT_VALUE,
  applyStockSelection,
  getNewProductConflictMessage,
  validateRepuestoDraft,
  type RepuestoValidatorEnv,
  type InventarioEntry,
} from "./repuestoValidator";

const emptyDraft: RepuestoDraft = {
  stockId: "",
  cantidad: "1",
  montoUnitario: "",
  codigo: "",
  nombre: "",
  precioCompra: "",
  precioVenta: "",
  precioVentaTouched: false,
};

const baseEnv: RepuestoValidatorEnv = {
  tallerId: "taller-1",
  items: [],
  inventario: [],
};

const stock = (over: Partial<InventarioEntry> & { id: string }): InventarioEntry => ({
  codigo: null,
  stockActual: 0,
  ...over,
});

const item = (over: Partial<RepuestoLinea> & { id: string; stock_id: string }): RepuestoLinea => ({
  cantidad: 1,
  monto_unitario: 0,
  ...over,
});

describe("validateRepuestoDraft", () => {
  it("requires a tallerId", () => {
    const result = validateRepuestoDraft(emptyDraft, { mode: "add" }, { ...baseEnv, tallerId: null });
    expect(result).toEqual({ ok: false, message: "No hay taller asociado" });
  });

  it("requires a stockId", () => {
    const result = validateRepuestoDraft(emptyDraft, { mode: "add" }, baseEnv);
    expect(result).toEqual({ ok: false, message: "Falta producto" });
  });

  it("rejects non-positive cantidad", () => {
    const result = validateRepuestoDraft(
      { ...emptyDraft, stockId: "abc", cantidad: "0" },
      { mode: "add" },
      baseEnv,
    );
    expect(result).toEqual({ ok: false, message: "Cantidad inválida" });
  });

  describe("new product branch", () => {
    const newProductBase = { ...emptyDraft, stockId: NEW_PRODUCT_VALUE, cantidad: "1" };

    it("requires código", () => {
      const result = validateRepuestoDraft(newProductBase, { mode: "add" }, baseEnv);
      expect(result).toEqual({ ok: false, message: "Falta código" });
    });

    it("requires nombre", () => {
      const result = validateRepuestoDraft(
        { ...newProductBase, codigo: "FIL-001" },
        { mode: "add" },
        baseEnv,
      );
      expect(result).toEqual({ ok: false, message: "Falta nombre" });
    });

    it("rejects negative precio de compra", () => {
      const result = validateRepuestoDraft(
        { ...newProductBase, codigo: "C", nombre: "N", precioCompra: "-5", precioVenta: "10" },
        { mode: "add" },
        baseEnv,
      );
      expect(result).toEqual({ ok: false, message: "Precio de compra inválido" });
    });

    it("rejects negative precio de venta", () => {
      const result = validateRepuestoDraft(
        { ...newProductBase, codigo: "C", nombre: "N", precioCompra: "5", precioVenta: "-10" },
        { mode: "add" },
        baseEnv,
      );
      expect(result).toEqual({ ok: false, message: "Precio de venta inválido" });
    });

    it("flags duplicate codigo against another new item", () => {
      const env: RepuestoValidatorEnv = {
        ...baseEnv,
        items: [
          item({
            id: "x",
            stock_id: NEW_PRODUCT_VALUE,
            tipo: "nuevo",
            nuevoProducto: { codigo: "FIL-001", nombre: "N", precioCompra: 0, precioVenta: 0 },
          }),
        ],
      };
      const result = validateRepuestoDraft(
        { ...newProductBase, codigo: "FIL-001", nombre: "N", precioCompra: "5", precioVenta: "10" },
        { mode: "add" },
        env,
      );
      expect(result).toEqual({ ok: false, message: "Este producto ya fue cargado en este arreglo" });
    });

    it("flags codigo that already exists in inventario", () => {
      const env: RepuestoValidatorEnv = {
        ...baseEnv,
        inventario: [stock({ id: "s1", codigo: "FIL-001" })],
      };
      const result = validateRepuestoDraft(
        { ...newProductBase, codigo: "FIL-001", nombre: "N", precioCompra: "5", precioVenta: "10" },
        { mode: "add" },
        env,
      );
      expect(result).toEqual({
        ok: false,
        message: "Ya existe un producto con ese código. Seleccionalo desde el listado.",
      });
    });

    it("returns an upsert payload when the new product is valid", () => {
      const result = validateRepuestoDraft(
        {
          ...newProductBase,
          cantidad: "3",
          codigo: "FIL-001",
          nombre: "Filtro",
          precioCompra: "5",
          precioVenta: "12",
        },
        { mode: "add" },
        baseEnv,
      );
      expect(result).toEqual({
        ok: true,
        value: {
          tipo: "nuevo",
          codigo: "FIL-001",
          nombre: "Filtro",
          precio_compra: 5,
          precio_venta: 12,
          cantidad: 3,
          monto_unitario: 12,
        },
      });
    });
  });

  describe("existing stock branch", () => {
    const existingBase = { ...emptyDraft, stockId: "s1", cantidad: "2", montoUnitario: "100" };

    it("rejects negative monto unitario", () => {
      const env: RepuestoValidatorEnv = { ...baseEnv, inventario: [stock({ id: "s1", stockActual: 10 })] };
      const result = validateRepuestoDraft(
        { ...existingBase, montoUnitario: "-1" },
        { mode: "add" },
        env,
      );
      expect(result).toEqual({ ok: false, message: "Monto inválido" });
    });

    it("blocks adding the same stock twice in add mode", () => {
      const env: RepuestoValidatorEnv = {
        ...baseEnv,
        inventario: [stock({ id: "s1", stockActual: 10 })],
        items: [item({ id: "a", stock_id: "s1" })],
      };
      const result = validateRepuestoDraft(existingBase, { mode: "add" }, env);
      expect(result).toEqual({ ok: false, message: "Ese repuesto ya está agregado" });
    });

    it("allows editing the same stock that is already in the arreglo", () => {
      const target = item({ id: "a", stock_id: "s1", cantidad: 2 });
      const env: RepuestoValidatorEnv = {
        ...baseEnv,
        inventario: [stock({ id: "s1", stockActual: 10 })],
        items: [target],
      };
      const result = validateRepuestoDraft(existingBase, { mode: "edit", item: target }, env);
      expect(result.ok).toBe(true);
    });

    it("returns 'Stock no encontrado' when the stockId is not in inventario", () => {
      const result = validateRepuestoDraft(existingBase, { mode: "add" }, baseEnv);
      expect(result).toEqual({ ok: false, message: "Stock no encontrado" });
    });

    it("returns ok when stockActual covers the cantidad", () => {
      const env: RepuestoValidatorEnv = {
        ...baseEnv,
        inventario: [stock({ id: "s1", stockActual: 10 })],
      };
      const result = validateRepuestoDraft(
        { ...existingBase, cantidad: "3" },
        { mode: "add" },
        env,
      );
      expect(result).toEqual({
        ok: true,
        value: { tipo: "existente", stock_id: "s1", cantidad: 3, monto_unitario: 100 },
      });
    });

    it("requires precio de compra when stockActual is insufficient", () => {
      const env: RepuestoValidatorEnv = {
        ...baseEnv,
        inventario: [stock({ id: "s1", stockActual: 1 })],
      };
      const result = validateRepuestoDraft(
        { ...existingBase, cantidad: "3" },
        { mode: "add" },
        env,
      );
      expect(result).toEqual({
        ok: false,
        message: "Falta precio de compra para cubrir el faltante",
      });
    });

    it("emits precio_compra in the payload when stock is insufficient", () => {
      const env: RepuestoValidatorEnv = {
        ...baseEnv,
        inventario: [stock({ id: "s1", stockActual: 1 })],
      };
      const result = validateRepuestoDraft(
        { ...existingBase, cantidad: "3", precioCompra: "50" },
        { mode: "add" },
        env,
      );
      expect(result).toEqual({
        ok: true,
        value: {
          tipo: "existente",
          stock_id: "s1",
          cantidad: 3,
          monto_unitario: 100,
          precio_compra: 50,
        },
      });
    });

    it("uses item.cantidad as baseQty so editing within current stock succeeds", () => {
      const target = item({ id: "a", stock_id: "s1", cantidad: 5 });
      const env: RepuestoValidatorEnv = {
        ...baseEnv,
        inventario: [stock({ id: "s1", stockActual: 2 })],
        items: [target],
      };
      // 5 → 6: delta = 1, stockActual = 2 → no faltante
      const result = validateRepuestoDraft(
        { ...existingBase, cantidad: "6" },
        { mode: "edit", item: target },
        env,
      );
      expect(result.ok).toBe(true);
    });
  });
});

describe("getNewProductConflictMessage", () => {
  it("returns null for an empty codigo", () => {
    expect(getNewProductConflictMessage("", { items: [], inventario: [] })).toBeNull();
    expect(getNewProductConflictMessage("   ", { items: [], inventario: [] })).toBeNull();
  });

  it("flags collision with another new item", () => {
    const env = {
      items: [
        item({
          id: "x",
          stock_id: NEW_PRODUCT_VALUE,
          tipo: "nuevo" as const,
          nuevoProducto: { codigo: "FIL-001", nombre: "N", precioCompra: 0, precioVenta: 0 },
        }),
      ],
      inventario: [],
    };
    expect(getNewProductConflictMessage("FIL-001", env)).toBe(
      "Este producto ya fue cargado en este arreglo",
    );
  });

  it("flags collision with an existing repuesto's producto.codigo", () => {
    const env = {
      items: [item({ id: "x", stock_id: "s1", producto: { codigo: "FIL-001" } })],
      inventario: [],
    };
    expect(getNewProductConflictMessage("FIL-001", env)).toBe(
      "Este producto ya fue cargado en este arreglo",
    );
  });

  it("flags collision with an inventario entry", () => {
    const env = { items: [], inventario: [stock({ id: "s1", codigo: "FIL-001" })] };
    expect(getNewProductConflictMessage("FIL-001", env)).toBe(
      "Ya existe un producto con ese código. Seleccionalo desde el listado.",
    );
  });

  it("ignores the current item when checking duplicates", () => {
    const env = {
      items: [
        item({
          id: "x",
          stock_id: NEW_PRODUCT_VALUE,
          tipo: "nuevo" as const,
          nuevoProducto: { codigo: "FIL-001", nombre: "N", precioCompra: 0, precioVenta: 0 },
        }),
      ],
      inventario: [],
    };
    expect(getNewProductConflictMessage("FIL-001", env, "x")).toBeNull();
  });
});

describe("applyStockSelection", () => {
  it("preserves new-product fields when picking the sentinel", () => {
    const prev: RepuestoDraft = {
      ...emptyDraft,
      codigo: "X",
      nombre: "Y",
      precioCompra: "5",
      precioVenta: "10",
      precioVentaTouched: true,
    };
    expect(applyStockSelection(NEW_PRODUCT_VALUE, prev, [])).toEqual({
      ...prev,
      stockId: NEW_PRODUCT_VALUE,
      montoUnitario: "",
    });
  });

  it("prefills monto unitario and precio compra from the picked stock", () => {
    const result = applyStockSelection("s1", emptyDraft, [
      { id: "s1", precioUnitario: 150, costoUnitario: 100 },
    ]);
    expect(result).toMatchObject({
      stockId: "s1",
      montoUnitario: "150",
      precioCompra: "100",
      precioVenta: "",
      precioVentaTouched: false,
    });
  });

  it("keeps the user-typed monto unitario instead of overwriting with the prefill", () => {
    const result = applyStockSelection(
      "s1",
      { ...emptyDraft, montoUnitario: "200" },
      [{ id: "s1", precioUnitario: 150, costoUnitario: 100 }],
    );
    expect(result.montoUnitario).toBe("200");
    expect(result.precioCompra).toBe("100");
  });

  it("clears prefill fields when the id is unknown or empty", () => {
    const result = applyStockSelection(
      "",
      { ...emptyDraft, precioVenta: "9", precioCompra: "8", precioVentaTouched: true },
      [],
    );
    expect(result).toMatchObject({
      stockId: "",
      precioVenta: "",
      precioCompra: "",
      precioVentaTouched: false,
    });
  });
});

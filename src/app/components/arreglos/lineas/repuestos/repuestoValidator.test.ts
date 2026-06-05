import { describe, expect, it } from "vitest";
import type { RepuestoDraft, RepuestoLinea } from "./RepuestoLineasEditableSection";
import {
  NEW_PRODUCT_VALUE,
  applyStockSelection,
  computeStockState,
  getNewProductConflictMessage,
  getNextNewProductCode,
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
  it("requiere tallerId", () => {
    const result = validateRepuestoDraft(emptyDraft, { mode: "add" }, { ...baseEnv, tallerId: null });
    expect(result).toEqual({ ok: false, message: "No hay taller asociado" });
  });

  it("requiere stockId", () => {
    const result = validateRepuestoDraft(emptyDraft, { mode: "add" }, baseEnv);
    expect(result).toEqual({ ok: false, message: "Falta producto" });
  });

  it("rechaza cantidad no positiva", () => {
    const result = validateRepuestoDraft(
      { ...emptyDraft, stockId: "abc", cantidad: "0" },
      { mode: "add" },
      baseEnv,
    );
    expect(result).toEqual({ ok: false, message: "Cantidad inválida" });
  });

  describe("producto nuevo", () => {
    const newProductBase = { ...emptyDraft, stockId: NEW_PRODUCT_VALUE, cantidad: "1" };

    it("requiere código", () => {
      const result = validateRepuestoDraft(newProductBase, { mode: "add" }, baseEnv);
      expect(result).toEqual({ ok: false, message: "Falta código" });
    });

    it("requiere nombre", () => {
      const result = validateRepuestoDraft(
        { ...newProductBase, codigo: "FIL-001" },
        { mode: "add" },
        baseEnv,
      );
      expect(result).toEqual({ ok: false, message: "Falta nombre" });
    });

    it("rechaza precio de compra negativo", () => {
      const result = validateRepuestoDraft(
        { ...newProductBase, codigo: "C", nombre: "N", precioCompra: "-5", precioVenta: "10" },
        { mode: "add" },
        baseEnv,
      );
      expect(result).toEqual({ ok: false, message: "Precio de compra inválido" });
    });

    it("rechaza precio de venta negativo", () => {
      const result = validateRepuestoDraft(
        { ...newProductBase, codigo: "C", nombre: "N", precioCompra: "5", precioVenta: "-10" },
        { mode: "add" },
        baseEnv,
      );
      expect(result).toEqual({ ok: false, message: "Precio de venta inválido" });
    });

    it("detecta código duplicado contra otro item nuevo", () => {
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

    it("detecta código que ya existe en inventario", () => {
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

    it("devuelve payload de upsert cuando el producto nuevo es válido", () => {
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

  describe("stock existente", () => {
    const existingBase = { ...emptyDraft, stockId: "s1", cantidad: "2", montoUnitario: "100" };

    it("rechaza monto unitario negativo", () => {
      const env: RepuestoValidatorEnv = { ...baseEnv, inventario: [stock({ id: "s1", stockActual: 10 })] };
      const result = validateRepuestoDraft(
        { ...existingBase, montoUnitario: "-1" },
        { mode: "add" },
        env,
      );
      expect(result).toEqual({ ok: false, message: "Monto inválido" });
    });

    it("bloquea agregar el mismo stock dos veces en modo agregar", () => {
      const env: RepuestoValidatorEnv = {
        ...baseEnv,
        inventario: [stock({ id: "s1", stockActual: 10 })],
        items: [item({ id: "a", stock_id: "s1" })],
      };
      const result = validateRepuestoDraft(existingBase, { mode: "add" }, env);
      expect(result).toEqual({ ok: false, message: "Ese repuesto ya está agregado" });
    });

    it("permite editar el mismo stock que ya está en el arreglo", () => {
      const target = item({ id: "a", stock_id: "s1", cantidad: 2 });
      const env: RepuestoValidatorEnv = {
        ...baseEnv,
        inventario: [stock({ id: "s1", stockActual: 10 })],
        items: [target],
      };
      const result = validateRepuestoDraft(existingBase, { mode: "edit", item: target }, env);
      expect(result.ok).toBe(true);
    });

    it("devuelve error cuando el stockId no está en inventario", () => {
      const result = validateRepuestoDraft(existingBase, { mode: "add" }, baseEnv);
      expect(result).toEqual({ ok: false, message: "Stock no encontrado" });
    });

    it("devuelve ok cuando el stock cubre la cantidad", () => {
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

    it("requiere precio de compra cuando el stock es insuficiente", () => {
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

    it("incluye precio_compra en el payload cuando el stock es insuficiente", () => {
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

    it("usa item.cantidad como baseQty para que editar dentro del stock actual funcione", () => {
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
  it("devuelve null para código vacío", () => {
    expect(getNewProductConflictMessage("", { items: [], inventario: [] })).toBeNull();
    expect(getNewProductConflictMessage("   ", { items: [], inventario: [] })).toBeNull();
  });

  it("detecta colisión con otro item nuevo", () => {
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

  it("detecta colisión con el código de un repuesto existente", () => {
    const env = {
      items: [item({ id: "x", stock_id: "s1", producto: { codigo: "FIL-001" } })],
      inventario: [],
    };
    expect(getNewProductConflictMessage("FIL-001", env)).toBe(
      "Este producto ya fue cargado en este arreglo",
    );
  });

  it("detecta colisión con una entrada del inventario", () => {
    const env = { items: [], inventario: [stock({ id: "s1", codigo: "FIL-001" })] };
    expect(getNewProductConflictMessage("FIL-001", env)).toBe(
      "Ya existe un producto con ese código. Seleccionalo desde el listado.",
    );
  });

  it("ignora el item actual al verificar duplicados", () => {
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

describe("computeStockState", () => {
  it("detecta modo agregar cuando item es null", () => {
    const result = computeStockState(null, emptyDraft, [], []);
    expect(result.mode).toBe("add");
  });

  it("detecta modo editar cuando se provee un item", () => {
    const target = item({ id: "a", stock_id: "s1" });
    const result = computeStockState(target, { ...emptyDraft, stockId: "s1" }, [target], []);
    expect(result.mode).toBe("edit");
  });

  it("marca isNewProduct cuando el stockId es el sentinel de nuevo producto", () => {
    const draft = { ...emptyDraft, stockId: NEW_PRODUCT_VALUE };
    const result = computeStockState(null, draft, [], []);
    expect(result.isNewProduct).toBe(true);
  });

  it("marca isNewProduct cuando se edita un item de tipo nuevo", () => {
    const target = item({ id: "a", stock_id: NEW_PRODUCT_VALUE, tipo: "nuevo" });
    const result = computeStockState(target, { ...emptyDraft, stockId: NEW_PRODUCT_VALUE }, [target], []);
    expect(result.isNewProduct).toBe(true);
  });

  it("no marca isNewProduct para una selección de stock regular", () => {
    const inv = [stock({ id: "s1", stockActual: 10 })];
    const result = computeStockState(null, { ...emptyDraft, stockId: "s1", cantidad: "1" }, [], inv);
    expect(result.isNewProduct).toBe(false);
  });

  it("detecta conflicto de repuesto duplicado al agregar un stock que ya está en items", () => {
    const inv = [stock({ id: "s1", stockActual: 10 })];
    const existing = [item({ id: "a", stock_id: "s1" })];
    const result = computeStockState(null, { ...emptyDraft, stockId: "s1" }, existing, inv);
    expect(result.hasExistingRepuestoConflict).toBe(true);
    expect(result.hasStockIssue).toBe(false);
  });

  it("no marca conflicto al editar el mismo item", () => {
    const target = item({ id: "a", stock_id: "s1" });
    const inv = [stock({ id: "s1", stockActual: 10 })];
    const result = computeStockState(target, { ...emptyDraft, stockId: "s1" }, [target], inv);
    expect(result.hasExistingRepuestoConflict).toBe(false);
  });

  it("detecta faltante de stock cuando la cantidad excede el disponible", () => {
    const inv = [stock({ id: "s1", stockActual: 2 })];
    const draft = { ...emptyDraft, stockId: "s1", cantidad: "5" };
    const result = computeStockState(null, draft, [], inv);
    expect(result.hasStockIssue).toBe(true);
    expect(result.faltante).toBe(3);
    expect(result.stockActual).toBe(2);
  });

  it("no marca faltante cuando el stock cubre la cantidad", () => {
    const inv = [stock({ id: "s1", stockActual: 10 })];
    const draft = { ...emptyDraft, stockId: "s1", cantidad: "5" };
    const result = computeStockState(null, draft, [], inv);
    expect(result.hasStockIssue).toBe(false);
    expect(result.faltante).toBe(0);
  });

  it("conflicto de duplicado tiene prioridad sobre faltante de stock", () => {
    const inv = [stock({ id: "s1", stockActual: 1 })];
    const existing = [item({ id: "a", stock_id: "s1" })];
    const draft = { ...emptyDraft, stockId: "s1", cantidad: "5" };
    const result = computeStockState(null, draft, existing, inv);
    expect(result.hasExistingRepuestoConflict).toBe(true);
    expect(result.hasStockIssue).toBe(false);
  });

  it("showPurchaseField es true para productos nuevos", () => {
    const draft = { ...emptyDraft, stockId: NEW_PRODUCT_VALUE, cantidad: "1" };
    const result = computeStockState(null, draft, [], []);
    expect(result.showPurchaseField).toBe(true);
  });

  it("showPurchaseField es true cuando el stock es insuficiente", () => {
    const inv = [stock({ id: "s1", stockActual: 1 })];
    const draft = { ...emptyDraft, stockId: "s1", cantidad: "5" };
    const result = computeStockState(null, draft, [], inv);
    expect(result.showPurchaseField).toBe(true);
  });

  it("showPurchaseField es false cuando el stock cubre la cantidad", () => {
    const inv = [stock({ id: "s1", stockActual: 10 })];
    const draft = { ...emptyDraft, stockId: "s1", cantidad: "3" };
    const result = computeStockState(null, draft, [], inv);
    expect(result.showPurchaseField).toBe(false);
  });

  it("usa item.cantidad como baseQty al editar, reduciendo el faltante", () => {
    const target = item({ id: "a", stock_id: "s1", cantidad: 5 });
    const inv = [stock({ id: "s1", stockActual: 2 })];
    const draft = { ...emptyDraft, stockId: "s1", cantidad: "6" };
    // faltante = 6 - 5(baseQty) - 2(stock) = 0 → no faltante
    const result = computeStockState(target, draft, [target], inv);
    expect(result.hasStockIssue).toBe(false);
  });
});

describe("applyStockSelection", () => {
  it("preserva campos de producto nuevo al seleccionar el sentinel", () => {
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

  it("precarga el codigo sugerido al seleccionar producto nuevo si el draft no tiene codigo", () => {
    expect(applyStockSelection(NEW_PRODUCT_VALUE, emptyDraft, [], "AL4")).toEqual({
      ...emptyDraft,
      stockId: NEW_PRODUCT_VALUE,
      montoUnitario: "",
      codigo: "AL4",
    });
  });

  it("no pisa el codigo ingresado al seleccionar producto nuevo", () => {
    const result = applyStockSelection(
      NEW_PRODUCT_VALUE,
      { ...emptyDraft, codigo: "MANUAL-1" },
      [],
      "AL4",
    );
    expect(result.codigo).toBe("MANUAL-1");
  });

  it("precarga monto unitario y precio compra del stock seleccionado", () => {
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

  it("conserva el monto unitario ingresado por el usuario sin sobreescribir", () => {
    const result = applyStockSelection(
      "s1",
      { ...emptyDraft, montoUnitario: "200" },
      [{ id: "s1", precioUnitario: 150, costoUnitario: 100 }],
    );
    expect(result.montoUnitario).toBe("200");
    expect(result.precioCompra).toBe("100");
  });

  it("limpia campos precargados cuando el id es desconocido o vacío", () => {
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

describe("getNextNewProductCode", () => {
  it("devuelve AL1 cuando no hay codigos AL", () => {
    expect(
      getNextNewProductCode({
        items: [],
        inventario: [stock({ id: "s1", codigo: "FIL-001" })],
      }),
    ).toBe("AL1");
  });

  it("usa el mayor numero de los codigos AL del inventario y suma uno", () => {
    expect(
      getNextNewProductCode({
        items: [],
        inventario: [
          stock({ id: "s1", codigo: "AL1" }),
          stock({ id: "s2", codigo: "AL9" }),
          stock({ id: "s3", codigo: "FIL-001" }),
        ],
      }),
    ).toBe("AL10");
  });

  it("ignora codigos que empiezan con AL pero no tienen sufijo numerico", () => {
    expect(
      getNextNewProductCode({
        items: [],
        inventario: [
          stock({ id: "s1", codigo: "ALFA" }),
          stock({ id: "s2", codigo: "AL-9" }),
          stock({ id: "s3", codigo: "AL2" }),
        ],
      }),
    ).toBe("AL3");
  });

  it("incluye productos ya cargados en el arreglo para evitar sugerir duplicados", () => {
    expect(
      getNextNewProductCode({
        inventario: [stock({ id: "s1", codigo: "AL4" })],
        items: [
          item({
            id: "x",
            stock_id: NEW_PRODUCT_VALUE,
            tipo: "nuevo",
            nuevoProducto: { codigo: "AL7", nombre: "N", precioCompra: 0, precioVenta: 0 },
          }),
        ],
      }),
    ).toBe("AL8");
  });
});

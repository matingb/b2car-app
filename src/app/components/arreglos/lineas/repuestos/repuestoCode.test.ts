import { describe, expect, it } from "vitest";
import { NEW_PRODUCT_VALUE } from "./repuestoValidator";
import { generateProductCode, getNextNewProductCode } from "./repuestoCode";

const stock = (over: { id: string; codigo?: string | null }) => ({ codigo: null, ...over });

const item = (over: {
  id: string;
  stock_id: string;
  tipo?: string;
  nuevoProducto?: { codigo: string; nombre: string; precioCompra: number; precioVenta: number };
  produto?: { codigo?: string | null };
}) => ({ cantidad: 1, monto_unitario: 0, ...over });

describe("generateProductCode", () => {
  it("genera slug con dos palabras significativas", () => {
    expect(generateProductCode("Filtro aceite", { items: [], inventario: [] })).toBe("FIL-ACE-001");
  });

  it("filtra palabras vacías (de, el, la, del...)", () => {
    expect(generateProductCode("Filtro de aceite", { items: [], inventario: [] })).toBe("FIL-ACE-001");
    expect(generateProductCode("Bomba del agua", { items: [], inventario: [] })).toBe("BOM-AGU-001");
  });

  it("maneja tres palabras significativas", () => {
    expect(generateProductCode("Filtro de aceite motor", { items: [], inventario: [] })).toBe("FIL-ACE-MOT-001");
  });

  it("normaliza acentos y caracteres especiales", () => {
    expect(generateProductCode("Distribución aceite", { items: [], inventario: [] })).toBe("DIS-ACE-001");
    expect(generateProductCode("Válvula escape", { items: [], inventario: [] })).toBe("VAL-ESC-001");
  });

  it("incrementa el contador si el código base ya existe en inventario", () => {
    const env = { items: [], inventario: [stock({ id: "s1", codigo: "FIL-ACE-001" })] };
    expect(generateProductCode("Filtro aceite", env)).toBe("FIL-ACE-002");
  });

  it("incrementa el contador si el código base ya existe en items", () => {
    const env = {
      inventario: [],
      items: [
        item({
          id: "x",
          stock_id: NEW_PRODUCT_VALUE,
          tipo: "nuevo",
          nuevoProducto: { codigo: "FIL-ACE-001", nombre: "N", precioCompra: 0, precioVenta: 0 },
        }),
      ],
    };
    expect(generateProductCode("Filtro aceite", env)).toBe("FIL-ACE-002");
  });

  it("salta múltiples colisiones y devuelve el próximo libre", () => {
    const env = {
      items: [],
      inventario: [
        stock({ id: "s1", codigo: "FIL-ACE-001" }),
        stock({ id: "s2", codigo: "FIL-ACE-002" }),
        stock({ id: "s3", codigo: "FIL-ACE-003" }),
      ],
    };
    expect(generateProductCode("Filtro aceite", env)).toBe("FIL-ACE-004");
  });

  it("incluye números en el slug para nombres con cifras", () => {
    expect(generateProductCode("Aceite 10W40", { items: [], inventario: [] })).toBe("ACE-10W-001");
  });

  it("usa palabra única si el nombre tiene una sola palabra significativa", () => {
    expect(generateProductCode("Filtro", { items: [], inventario: [] })).toBe("FIL-001");
  });

  it("usa getNextNewProductCode como fallback si el nombre está vacío", () => {
    const env = { items: [], inventario: [stock({ id: "s1", codigo: "AL3" })] };
    expect(generateProductCode("   ", env)).toBe("AL4");
  });

  it("la comparación de colisiones es case-insensitive", () => {
    const env = { items: [], inventario: [stock({ id: "s1", codigo: "fil-ace-001" })] };
    expect(generateProductCode("Filtro aceite", env)).toBe("FIL-ACE-002");
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

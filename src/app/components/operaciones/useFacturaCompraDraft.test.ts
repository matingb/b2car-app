import { expect, it } from "vitest";
import { buildFacturaCompraInput, type FacturaCompraDraft } from "./useFacturaCompraDraft";

const draft: FacturaCompraDraft = {
  clase: "A", numero: "1-1", fecha: "2026-01-01", emisorRazonSocial: "Proveedor",
  emisorCuit: "30712345678", emisorCondicionIva: "RESPONSABLE_INSCRIPTO", emisorDomicilio: "",
  fechaVencimiento: "", percepciones: [],
};

const conceptos = [
  { key: "a", descripcion: "Primero", importe: 100, ivaAlicuotaId: 4 },
  { key: "b", descripcion: "Segundo", importe: 100, ivaAlicuotaId: 6 },
  { key: "c", descripcion: "Tercero", importe: 100, ivaAlicuotaId: null },
];

it("deriva el desglose de factura A de las tasas cargadas en los conceptos", () => {
  const result = buildFacturaCompraInput({ draft, fechaOperacion: "2026-01-01", conceptos, proveedorId: null, tipoOperacion: "COMPRA" });
  expect(result.error).toBeUndefined();
  expect(result.value?.lineas.map((line) => line.ivaAlicuotaId)).toEqual([4, 6, 5]);
  expect(result.value?.lineas.map((line) => line.importe)).toEqual([110.5, 127, 121]);
  expect(result.value?.desgloseIva).toEqual([
    { ivaAlicuotaId: 4, base: 100, iva: 10.5 },
    { ivaAlicuotaId: 5, base: 100, iva: 21 },
    { ivaAlicuotaId: 6, base: 100, iva: 27 },
  ]);
});

it("conserva las tasas elegidas y los importes finales de una compra con factura B", () => {
  const other = buildFacturaCompraInput({ draft: { ...draft, clase: "B" }, fechaOperacion: "2026-01-01", conceptos, proveedorId: null, tipoOperacion: "COMPRA" });
  expect(other.error).toBeUndefined();
  expect(other.value?.desgloseIva).toBeNull();
  expect(other.value?.ivaContenido).toBeNull();
  expect(other.value?.lineas.map((line) => line.ivaAlicuotaId)).toEqual([4, 6, 5]);
  expect(other.value?.lineas.map((line) => line.importe)).toEqual([100, 100, 100]);
});

it("calcula IVA para gastos con factura A y guarda el importe final de C sin tasa", () => {
  const expense = buildFacturaCompraInput({ draft, fechaOperacion: "2026-01-01", conceptos: [{ key: "gasto", descripcion: "Gasto", importe: 100 }], proveedorId: null, tipoOperacion: "GASTO" });
  expect(expense.value?.desgloseIva).toEqual([{ ivaAlicuotaId: 5, base: 100, iva: 21 }]);
  expect(expense.value?.lineas[0].importe).toBe(121);
  const expenseC = buildFacturaCompraInput({ draft: { ...draft, clase: "C" }, fechaOperacion: "2026-01-01", conceptos: [{ key: "gasto", descripcion: "Gasto", importe: 100 }], proveedorId: null, tipoOperacion: "GASTO" });
  expect(expenseC.value?.desgloseIva).toBeNull();
  expect(expenseC.value?.lineas[0].importe).toBe(100);
  expect(expenseC.value?.lineas[0].ivaAlicuotaId).toBeNull();
});

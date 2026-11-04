import { describe, expect, it } from "vitest";
import { FISCAL_COLUMNS, FISCAL_MONEY_KEYS, parseFiscalFilters } from "./reporteFiscal";

const params = (extra = "") => new URLSearchParams(`reporte=fiscal&format=csv&desde=2026-10-01&hasta=2026-10-31${extra}`);

describe("contrato fiscal", () => {
  it("tiene 24 columnas únicas, sin provincia ni columnas de trazabilidad, y solo base/IVA al 21%", () => {
    expect(FISCAL_COLUMNS).toHaveLength(24);
    expect(new Set(FISCAL_COLUMNS.map(c => c.key)).size).toBe(24);
    expect(FISCAL_COLUMNS.some(c => c.header.includes("Provincia"))).toBe(false);
    for (const key of ["moneda", "origenId", "asociado", "facturaId", "estadoDesglose"]) {
      expect(FISCAL_COLUMNS.some(c => c.key === key)).toBe(false);
    }
    expect(FISCAL_COLUMNS.filter(c => c.header.includes("%"))).toEqual([
      expect.objectContaining({ key: "base21" }), expect.objectContaining({ key: "iva21" }),
    ]);
    expect(FISCAL_COLUMNS.filter(c => c.kind === "money").map(c => c.key)).toEqual(FISCAL_MONEY_KEYS);
  });
  it("acepta extremos inclusivos, todos los documentos/orígenes y CUIT textual", () => {
    expect(parseFiscalFilters(params("&documentoTipo=NOTA_CREDITO&origenTipo=VENTA&cuitEmisor=20123456789"))).toMatchObject({
      desde: "2026-10-01", hasta: "2026-10-31", documentoTipo: "NOTA_CREDITO", origenTipo: "VENTA", cuitEmisor: "20123456789",
    });
    expect(parseFiscalFilters(new URLSearchParams("reporte=fiscal&format=xlsx&desde=2024-02-29&hasta=2024-02-29")).format).toBe("xlsx");
  });
  it.each([
    ["desde", ""], ["hasta", "2026-02-29"], ["desde", "2026-11-01"], ["desde", "2026-04-31"],
    ["format", "pdf"], ["reporte", "otro"], ["documentoTipo", "REMITO"], ["origenTipo", "COMPRA"], ["cuitEmisor", "20-12345678-9"],
  ])("rechaza %s=%s", (key, value) => {
    const query = params(); query.set(key, value);
    expect(() => parseFiscalFilters(query)).toThrow();
  });
  it.each(["search", "estado", "ambiente", "page", "pageSize", "clase", "factura", "tenantId"])("rechaza filtro operativo %s incluso vacío", key => {
    expect(() => parseFiscalFilters(params(`&${key}=`))).toThrow(/incompatible/);
  });
  it("rechaza parámetros duplicados", () => expect(() => parseFiscalFilters(params("&format=xlsx"))).toThrow(/repetido/));
});

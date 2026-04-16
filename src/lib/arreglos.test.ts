import { describe, expect, it } from "vitest";
import { ARREGLO_DESCRIPCION_FALLBACK, buildArregloDescripcion } from "./arreglos";

describe("buildArregloDescripcion", () => {
  it("concatena tipo y detalles cuando existe detalle_formulario", () => {
    expect(
      buildArregloDescripcion({
        tipo: "Service",
        detalles: [{ descripcion: "Cambio aceite" }, { descripcion: "Filtro de aire" }],
        detalleFormulario: [{ metadata: [] }],
      })
    ).toBe("Service | Cambio aceite | Filtro de aire");
  });

  it("usa solo el tipo cuando no hay detalles", () => {
    expect(
      buildArregloDescripcion({
        tipo: "Frenos",
        detalles: [],
      })
    ).toBe("Frenos");
  });

  it("usa solo los detalles cuando no hay tipo", () => {
    expect(
      buildArregloDescripcion({
        detalles: [{ descripcion: "Pastillas delanteras" }, { descripcion: "Rectificar discos" }],
      })
    ).toBe("Pastillas delanteras | Rectificar discos");
  });

  it("usa el fallback cuando no hay tipo ni detalles", () => {
    expect(
      buildArregloDescripcion({
        tipo: " ",
        detalles: [{ descripcion: "  " }],
      })
    ).toBe(ARREGLO_DESCRIPCION_FALLBACK);
  });
});

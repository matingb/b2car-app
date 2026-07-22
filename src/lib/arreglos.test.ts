import { describe, expect, it } from "vitest";
import { ARREGLO_DESCRIPCION_FALLBACK, buildArregloDescripcion } from "./arreglos";

describe("buildArregloDescripcion", () => {
  it("concatena detalles cuando existe detalle_formulario", () => {
    expect(
      buildArregloDescripcion({
        detalles: [{ descripcion: "Cambio aceite" }, { descripcion: "Filtro de aire" }],
        detalleFormulario: [{ metadata: [] }],
      })
    ).toBe("Cambio aceite | Filtro de aire");
  });

  it("usa el fallback cuando no hay detalles", () => {
    expect(
      buildArregloDescripcion({
        detalles: [],
      })
    ).toBe(ARREGLO_DESCRIPCION_FALLBACK);
  });

  it("usa solo los detalles cuando no hay tipo", () => {
    expect(
      buildArregloDescripcion({
        detalles: [{ descripcion: "Pastillas delanteras" }, { descripcion: "Rectificar discos" }],
      })
    ).toBe("Pastillas delanteras | Rectificar discos");
  });

  it("usa el fallback cuando no hay detalles validos", () => {
    expect(
      buildArregloDescripcion({
        detalles: [{ descripcion: "  " }],
      })
    ).toBe(ARREGLO_DESCRIPCION_FALLBACK);
  });
});

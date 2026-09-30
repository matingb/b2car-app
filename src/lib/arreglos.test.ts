import {
  ARREGLO_DESCRIPCION_FALLBACK,
  buildArregloDescripcion,
  formatArregloNumero,
  formatArregloTitulo,
} from "./arreglos";

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

describe("formatArregloNumero", () => {
  it("formatea con ceros a la izquierda por defecto (6 digitos)", () => {
    expect(formatArregloNumero(1)).toBe("#000001");
    expect(formatArregloNumero(42)).toBe("#000042");
    expect(formatArregloNumero(1234)).toBe("#001234");
    expect(formatArregloNumero(12345)).toBe("#012345");
    expect(formatArregloNumero(123456)).toBe("#123456");
  });

  it("permite especificar un padding diferente", () => {
    expect(formatArregloNumero(7, 4)).toBe("#0007");
    expect(formatArregloNumero(7, 8)).toBe("#00000007");
  });

  it("retorna string vacio ante valores nulos, indefinidos o menores/iguales a 0", () => {
    expect(formatArregloNumero(null)).toBe("");
    expect(formatArregloNumero(undefined)).toBe("");
    expect(formatArregloNumero(0)).toBe("");
    expect(formatArregloNumero(-5)).toBe("");
  });
});

describe("formatArregloTitulo", () => {
  it("concatena el numero formateado a la descripcion", () => {
    expect(
      formatArregloTitulo({ numero_orden: 1, descripcion: "Cambio de aceite" })
    ).toBe("#000001 - Cambio de aceite");
  });

  it("no duplica el numero si la descripcion ya empieza con el", () => {
    expect(
      formatArregloTitulo({ numero_orden: 1, descripcion: "#000001 - Cambio de aceite" })
    ).toBe("#000001 - Cambio de aceite");
  });

  it("retorna solo el numero formateado si la descripcion esta vacia", () => {
    expect(formatArregloTitulo({ numero_orden: 25, descripcion: "" })).toBe("#000025");
    expect(formatArregloTitulo({ numero_orden: 25, descripcion: null })).toBe("#000025");
  });

  it("retorna solo la descripcion si no hay numero_orden", () => {
    expect(
      formatArregloTitulo({ numero_orden: null, descripcion: "Mecánica general" })
    ).toBe("Mecánica general");
  });

  it("usa el fallback si ni numero_orden ni descripcion estan presentes", () => {
    expect(formatArregloTitulo(null)).toBe("Arreglo sin descripción");
    expect(formatArregloTitulo({ numero_orden: null, descripcion: "" })).toBe(
      "Arreglo sin descripción"
    );
  });
});


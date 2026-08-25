import { describe, expect, it } from "vitest";
import { getArregloDeleteConfirmationMessage } from "./arregloDeleteConfirmation";

describe("getArregloDeleteConfirmationMessage", () => {
  it("mantiene la confirmacion simple cuando no hay cobros", () => {
    expect(getArregloDeleteConfirmationMessage(0)).toBe(
      "Estas seguro de que deseas eliminar este arreglo?"
    );
  });

  it("advierte el impacto financiero de un cobro asociado", () => {
    expect(getArregloDeleteConfirmationMessage(1)).toContain("1 cobro asociado");
    expect(getArregloDeleteConfirmationMessage(1)).toContain(
      "se revertira su operacion de ingreso"
    );
  });

  it("informa la cantidad cuando hay multiples cobros", () => {
    expect(getArregloDeleteConfirmationMessage(3)).toContain("3 cobros asociados");
  });
});

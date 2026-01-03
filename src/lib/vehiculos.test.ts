import { describe, it, expect } from "vitest";
import { formatPatente, formatPatenteConMarcaYModelo } from "./vehiculos";
import { createVehiculo } from "@/tests/factories";

describe("formatPatente", () => {
  it("dada una patente de 7 caracteres, deberia formatearla correctamente", () => {
    expect(formatPatente("AB123CD")).toBe("AB 123 CD");
  });

  it("dada una patente de 6 caracteres, deberia formatearla correctamente", () => {
    expect(formatPatente("ABC123")).toBe("ABC 123");
  });

  it("debería devolver la patente tal cual si no tiene 6 o 7 caracteres", () => {
    expect(formatPatente("AB12")).toBe("AB12");
    expect(formatPatente("ABCDEFGH")).toBe("ABCDEFGH");
  });
});

describe("formatPatenteConMarcaYModelo", () => {
  it("cuando marca y modelo están presentes, devuelve 'patente - marca modelo'", () => {
    const vehiculo = createVehiculo({ marca: "Ford", modelo: "Fiesta" });

    const patenteFormateada = formatPatenteConMarcaYModelo(vehiculo);

    expect(patenteFormateada).toBe("ABC123 - Ford Fiesta");
  });

  it("cuando marca y modelo están ausentes, devuelve solo la patente (sin guion)", () => {
    const vehiculo = createVehiculo({ marca: "", modelo: "" });

    const patenteFormateada = formatPatenteConMarcaYModelo(vehiculo);

    expect(patenteFormateada).toBe("ABC123");
  });

  it("cuando falta marca o modelo, evita espacios extras y mantiene el guion solo si corresponde", () => {
    const vehiculoSoloMarca = createVehiculo({ marca: "Ford", modelo: "" });
    const vehiculoSoloModelo = createVehiculo({ marca: "", modelo: "Fiesta" });

    const patenteConMarca = formatPatenteConMarcaYModelo(vehiculoSoloMarca);
    const patenteConModelo = formatPatenteConMarcaYModelo(vehiculoSoloModelo);

    expect(patenteConMarca).toBe("ABC123 - Ford");
    expect(patenteConModelo).toBe("ABC123 - Fiesta");
  });

  it("hace trim de los campos para evitar espacios sobrantes", () => {
    const vehiculo = createVehiculo({
      patente: "  AA111BB  ",
      marca: "  Ford ",
      modelo: " Fiesta  ",
    });

    const patenteFormateada = formatPatenteConMarcaYModelo(vehiculo);

    expect(patenteFormateada).toBe("AA111BB - Ford Fiesta");
  });
});



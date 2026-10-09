import { describe, expect, it } from "vitest";
import {
  amountInPesosWords, emitterCommercialAddress, emitterFiscalIvaLabel,
  fceAcceptanceRegime, fceLegalLegend, receiverFiscalIvaLabel,
} from "./fiscalPresentation";

describe("importe fiscal en letras", () => {
  it.each([
    [0, "CERO CON 00/100"], [1, "UN CON 00/100"], [21.01, "VEINTIÚN CON 01/100"],
    [31.29, "TREINTA Y UN CON 29/100"], [100.99, "CIEN CON 99/100"],
    [101, "CIENTO UN CON 00/100"], [1000, "MIL CON 00/100"],
    [21000, "VEINTIÚN MIL CON 00/100"], [1000000, "UN MILLÓN CON 00/100"],
    [6101500, "SEIS MILLONES CIENTO UN MIL QUINIENTOS CON 00/100"],
    [1_000_000_000, "MIL MILLONES CON 00/100"],
    [999_999_999_999.99, "NOVECIENTOS NOVENTA Y NUEVE MIL NOVECIENTOS NOVENTA Y NUEVE MILLONES NOVECIENTOS NOVENTA Y NUEVE MIL NOVECIENTOS NOVENTA Y NUEVE CON 99/100"],
  ])("convierte %s con apócope y centavos", (amount, words) => {
    expect(amountInPesosWords(amount)).toBe(`PESOS ${words}.`);
  });
  it("conserva centavos frente al error binario de punto flotante", () => {
    expect(amountInPesosWords(0.1 + 0.2)).toBe("PESOS CERO CON 30/100.");
    expect(amountInPesosWords("1.01")).toBe("PESOS UN CON 01/100.");
  });
  it.each([1.005, -1, Infinity, NaN, 1_000_000_000_000])("rechaza %s sin redondear datos autorizados", (amount) => {
    expect(() => amountInPesosWords(amount)).toThrow();
  });
});

describe("régimen temporal FCE", () => {
  it.each([
    ["2024-10-31", "Res. 49/2023 y prórrogas hasta Res. 9/2024"],
    ["2024-11-01", "Res. 480/2024"], ["2025-10-31", "Res. 480/2024"],
    ["2025-11-01", "Res. 219/2025"], ["2026-10-09", "Res. 219/2025"],
    ["2026-10-31", "Res. 219/2025"],
  ])("selecciona la norma por fecha %s", (date, norma) => {
    expect(fceAcceptanceRegime(date)).toMatchObject({ dias: 21, norma });
  });
  it("vuelve al plazo legal base cuando termina la prórroga conocida", () => {
    expect(fceAcceptanceRegime("2026-11-01")).toMatchObject({ dias: 15, norma: "Ley 27.440, art. 5 inc. i), sin prórroga verificada" });
    expect(fceLegalLegend("2026-11-01")).toContain("15 días corridos");
  });
  it.each(["2023-03-31", "2026-02-30", "invalid", "2026-10-09T00:00:00Z"])("exige revisar fechas fuera de los regímenes verificados: %s", (date) => {
    expect(() => fceAcceptanceRegime(date)).toThrow("Debe revisarse el régimen");
  });
  it("distingue recepción de emisión y expresa los efectos jurídicos", () => {
    const legend = fceLegalLegend("2026-10-09");
    expect(legend).toContain("21 días corridos desde la recepción en el domicilio fiscal electrónico");
    expect(legend).toContain("rechazo total");
    expect(legend).toContain("cancelación");
    expect(legend).toContain("título ejecutivo");
    expect(legend).toContain("transferir a terceros");
    expect(legend).not.toMatch(/30\/10\/2026|2026-10-30/);
  });
});

describe("denominaciones y domicilio fiscales", () => {
  it.each(["MONOTRIBUTISTA", "Monotributista", "RESPONSABLE MONOTRIBUTO"])("normaliza %s sin cambiar el enum", (value) => {
    expect(emitterFiscalIvaLabel({ condicionIva: value })).toBe("RESPONSABLE MONOTRIBUTO");
  });
  it("normaliza responsable inscripto y prioriza el enum del snapshot", () => {
    expect(emitterFiscalIvaLabel({ condicionIva: "Responsable inscripto" })).toBe("IVA RESPONSABLE INSCRIPTO");
    expect(emitterFiscalIvaLabel({ condicionIvaEmisor: "MONOTRIBUTISTA", condicionIva: "Responsable inscripto" })).toBe("RESPONSABLE MONOTRIBUTO");
    expect(receiverFiscalIvaLabel(1)).toBe("IVA RESPONSABLE INSCRIPTO");
    expect(receiverFiscalIvaLabel(15)).toBe("NO RESPONSABLE IVA");
  });
  it("conserva el domicilio completo o agrega únicamente datos explícitos", () => {
    expect(emitterCommercialAddress({ domicilio: "Los Andes 1840", localidad: "San Martín", provincia: "Buenos Aires" })).toBe("Los Andes 1840, San Martín, Buenos Aires");
    expect(emitterCommercialAddress({ domicilio: "Los Andes 1840, San Martín, Buenos Aires", localidad: "San Martín", provincia: "Buenos Aires" })).toBe("Los Andes 1840, San Martín, Buenos Aires");
    expect(emitterCommercialAddress({ domicilio: "Los Andes 1840" })).toBe("Los Andes 1840");
  });
});

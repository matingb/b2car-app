import { describe, expect, it } from "vitest";
import {
  buildTerminadoRequiredFieldsErrorMessage,
  extractRequiredCustomFormFields,
  findMissingRequiredCustomFormFields,
} from "./arreglosCustomFormRequired";

describe("arreglosCustomFormRequired", () => {
  it("detecta required completos en formato object-lines", () => {
    const formMetadata = [
      {
        title: "Motor",
        inputs: [
          { key: "patente", label: "Patente", required: true },
          { key: "nota", label: "Nota", required: false },
        ],
      },
    ];

    const detalleMetadata = [
      {
        title: "Motor",
        inputs: [{ title: "Patente", value: "AA123BB" }],
      },
    ];

    const missing = findMissingRequiredCustomFormFields({
      formMetadata,
      detalleMetadata,
    });

    expect(missing).toEqual([]);
  });

  it("detecta faltantes en formato nested-lines", () => {
    const formMetadata = [
      [{ key: "obs", title: "Observacion", label: "Observacion", required: true }],
    ];

    const detalleMetadata = [
      {
        title: "Observacion",
        inputs: [{ title: "Observacion", value: "   " }],
      },
    ];

    const missing = findMissingRequiredCustomFormFields({
      formMetadata,
      detalleMetadata,
    });

    expect(missing).toEqual(["Observacion: Observacion"]);
  });

  it("considera false y 0 como valores validos", () => {
    const formMetadata = [
      {
        title: "Checklist",
        inputs: [
          { key: "aprobado", label: "Aprobado", required: true },
          { key: "km", label: "Km", required: true },
        ],
      },
    ];

    const detalleMetadata = [
      {
        title: "Checklist",
        inputs: [
          { title: "Aprobado", value: false },
          { title: "Km", value: "0" },
        ],
      },
    ];

    const missing = findMissingRequiredCustomFormFields({
      formMetadata,
      detalleMetadata,
    });

    expect(missing).toEqual([]);
  });

  it("soporta formato fallback con metadata.lineas", () => {
    const formMetadata = {
      lineas: [
        {
          title: "Linea A",
          fields: [{ key: "dato", label: "Dato", required: true }],
        },
      ],
    };

    const detalleMetadata = [
      {
        title: "Linea A",
        inputs: [{ title: "Dato", value: null }],
      },
    ];

    const missing = findMissingRequiredCustomFormFields({
      formMetadata,
      detalleMetadata,
    });

    expect(missing).toEqual(["Linea A: Dato"]);
  });

  it("extrae required con titulo de linea y campo", () => {
    const formMetadata = [
      {
        title: "Inspeccion",
        inputs: [{ key: "sello", label: "Sello", required: true }],
      },
    ];

    expect(extractRequiredCustomFormFields(formMetadata)).toEqual([
      { lineTitle: "Inspeccion", fieldLabel: "Sello" },
    ]);
  });

  it("arma mensaje de error con campos faltantes", () => {
    expect(
      buildTerminadoRequiredFieldsErrorMessage(["Motor: Patente", "Checklist: Km"])
    ).toContain("Motor: Patente");
  });
});


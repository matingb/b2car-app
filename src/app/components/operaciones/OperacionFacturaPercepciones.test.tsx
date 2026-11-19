import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { formatArs } from "@/lib/format";
import OperacionFacturaPercepciones from "./OperacionFacturaPercepciones";

const { form } = vi.hoisted(() => ({
  form: {
    tipo: "COMPRA",
    factura: {
      draft: { clase: "A", percepciones: [] },
      addPercepcion: vi.fn(),
      updatePercepcion: vi.fn(),
      removePercepcion: vi.fn(),
    },
    conceptosFactura: [
      { key: "a", descripcion: "Producto A", importe: 100, ivaAlicuotaId: 5 },
      { key: "b", descripcion: "Producto B", importe: 200, ivaAlicuotaId: 4 },
      { key: "c", descripcion: "Producto C", importe: 50, ivaAlicuotaId: 5 },
    ],
    isSubmitting: false,
  },
}));

vi.mock("./OperacionFormContext", () => ({ useOperacionForm: () => form }));

it("muestra el IVA calculado y agrupado por alícuota debajo de las percepciones", () => {
  render(<OperacionFacturaPercepciones />);

  expect(screen.getByTestId("operacion-iva-alicuota-5")).toHaveTextContent(formatArs(150));
  expect(screen.getByTestId("operacion-iva-alicuota-5")).toHaveTextContent(formatArs(31.5));
  expect(screen.getByTestId("operacion-iva-alicuota-4")).toHaveTextContent(formatArs(200));
  expect(screen.getByTestId("operacion-iva-alicuota-4")).toHaveTextContent(formatArs(21));
  expect(screen.getByTestId("operacion-iva-total")).toHaveTextContent(formatArs(52.5));
  expect(screen.getByTestId("operacion-factura-totales")).toHaveTextContent(formatArs(402.5));
});

it("discrimina el IVA incluido de factura B por las alícuotas de sus conceptos", () => {
  form.factura.draft.clase = "B";
  render(<OperacionFacturaPercepciones />);

  expect(screen.getByTestId("operacion-iva-alicuota-5")).toHaveTextContent(formatArs(123.97));
  expect(screen.getByTestId("operacion-iva-alicuota-5")).toHaveTextContent(formatArs(26.03));
  expect(screen.getByTestId("operacion-iva-alicuota-4")).toHaveTextContent(formatArs(181));
  expect(screen.getByTestId("operacion-iva-alicuota-4")).toHaveTextContent(formatArs(19));
  expect(screen.getByTestId("operacion-iva-total")).toHaveTextContent(formatArs(45.03));
  expect(screen.getByTestId("operacion-factura-totales")).toHaveTextContent(formatArs(350));
  form.factura.draft.clase = "A";
});

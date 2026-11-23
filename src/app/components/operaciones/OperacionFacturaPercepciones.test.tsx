import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { formatArs } from "@/lib/format";
import OperacionFacturaPercepciones from "./OperacionFacturaPercepciones";

const { form } = vi.hoisted(() => ({
  form: {
    tipo: "COMPRA",
    factura: {
      draft: { clase: "A", percepciones: [] },
      update: vi.fn(),
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
    importeTotal: 402.5,
  },
}));

vi.mock("./OperacionFormContext", () => ({ useOperacionForm: () => form }));

it("muestra solo las alícuotas que aparecen en los conceptos de factura A", () => {
  render(<OperacionFacturaPercepciones />);

  expect(screen.getByTestId("operacion-iva-alicuota-5")).toHaveTextContent(`Total IVA 21%${formatArs(31.5)}`);
  expect(screen.getByTestId("operacion-iva-alicuota-4")).toHaveTextContent(`Total IVA 10,5%${formatArs(21)}`);
  expect(screen.queryByLabelText(/Base confirmada/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/IVA confirmado/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Confirmar base e IVA/ })).not.toBeInTheDocument();
  const totals = screen.getByTestId("operacion-factura-totales");
  expect(totals).toHaveTextContent(`Conceptos: ${formatArs(350)}`);
  expect(totals).toHaveTextContent(`IVA: ${formatArs(52.5)}`);
  expect(totals).toHaveTextContent(`Percepciones: ${formatArs(0)}`);
  expect(totals).toHaveTextContent(`Total de factura: ${formatArs(402.5)}`);
});

it("muestra los importes finales de factura B sin panel de IVA contenido", () => {
  form.factura.draft.clase = "B";
  render(<OperacionFacturaPercepciones />);

  expect(screen.queryByTestId("operacion-iva-desglose")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("IVA contenido informado")).not.toBeInTheDocument();
  expect(screen.getByTestId("operacion-factura-totales")).toHaveTextContent(formatArs(350));
  expect(screen.getByTestId("operacion-factura-totales")).toHaveTextContent("IVA: No discriminado");
  form.factura.draft.clase = "A";
});

it("mantiene el total documental calculado desde los conceptos", () => {
  const draftOriginal = form.factura.draft;
  form.factura.draft = {
    ...draftOriginal,
    clase: "A",
  };

  render(<OperacionFacturaPercepciones />);

  expect(screen.getByTestId("operacion-factura-totales")).toHaveTextContent(formatArs(402.5));
  form.factura.draft = draftOriginal;
});

import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import OperacionFacturaFields from "./OperacionFacturaFields";
import type { FacturaCompraDraft } from "./useFacturaCompraDraft";

vi.mock("./OperacionFormContext", () => ({ useOperacionForm: () => useMockForm() }));

function useMockForm() {
  const [draft, setDraft] = useState<FacturaCompraDraft>({ clase: "A", ivaContenido: "", numero: "1-1", fecha: "", emisorRazonSocial: "Proveedor", emisorCuit: "30712345678", emisorCondicionIva: "RESPONSABLE_INSCRIPTO", emisorDomicilio: "", fechaVencimiento: "", percepciones: [] });
  return { factura: { draft, update: (patch: Partial<FacturaCompraDraft>) => setDraft((current) => ({ ...current, ...patch })), error: null }, fecha: "2026-01-01", tipo: "COMPRA", isSubmitting: false };
}

it("deja el IVA automático fuera de los campos manuales de la factura", () => {
  render(<OperacionFacturaFields />);
  expect(screen.getByTestId("operacion-factura-numero")).toBeInTheDocument();
  expect(screen.queryByLabelText(/Base neta/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/IVA facturado/)).not.toBeInTheDocument();
});

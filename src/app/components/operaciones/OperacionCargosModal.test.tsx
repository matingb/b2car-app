import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { comprobantesRecibidosClient } from "@/clients/comprobantesRecibidosClient";
import type { ComprobantesOperacion } from "@/lib/comprobantesRecibidos/types";
import type { Operacion } from "@/model/types";
import OperacionCargosModal from "./OperacionCargosModal";

const { update } = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/app/providers/OperacionesProvider", () => ({ useOperaciones: () => ({ update }) }));
vi.mock("@/clients/comprobantesRecibidosClient", () => ({
  comprobantesRecibidosClient: { listByOperacion: vi.fn() },
}));

it("copia únicamente las percepciones de la factura y edita la compra al confirmar", async () => {
  const compra: Operacion = {
    id: "compra-1",
    tipo: "COMPRA",
    taller_id: "taller-1",
    fecha: "2026-11-18",
    created_at: "2026-11-18",
    lineas: [],
    monto_total: 100000,
  };
  const updated = { ...compra, monto_total: 105000 };
  update.mockResolvedValue(updated);
  vi.mocked(comprobantesRecibidosClient.listByOperacion).mockResolvedValue({
    comprobantes: [{
      id: "factura-1",
      tipoDocumento: "FACTURA",
      clase: "A",
      numero: "0001-00001111",
      emisor: { razonSocial: "Proveedor de prueba" },
      lineas: [
        { tipo: "CONCEPTO", descripcion: "Mercadería", importe: 100000 },
        { tipo: "PERCEPCION", percepcionCodigo: "IVA", descripcion: "IVA", importe: 5000 },
      ],
    }],
  } as ComprobantesOperacion);
  const onSaved = vi.fn();

  render(<OperacionCargosModal operacion={compra} montoBase={100000} canViewRecibidos onClose={vi.fn()} onSaved={onSaved} />);

  fireEvent.click(await screen.findByRole("button", { name: "Copiar percepciones de una factura" }));
  fireEvent.click(screen.getByRole("option", { name: /0001-00001111/ }));
  expect(screen.getByLabelText("Importe de la percepción 1")).toHaveValue("5000");
  expect(update).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(updated));
  expect(update).toHaveBeenCalledExactlyOnceWith(compra.id, {
    cargos: [{ percepcion_codigo: "IVA", descripcion: "IVA", importe: 5000 }],
  });
});

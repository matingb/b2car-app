import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { ComprobanteRecibido, ComprobanteRecibidoPrecarga } from "@/lib/comprobantesRecibidos/types";
import ComprobanteRecibidoModal from "./ComprobanteRecibidoModal";

const { create, update } = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
vi.mock("@/app/providers/ToastProvider", () => ({ useToast: () => ({ success: vi.fn() }) }));
vi.mock("@/clients/comprobantesRecibidosClient", () => ({ comprobantesRecibidosClient: { create, update } }));

it("mantiene valores ausentes, exige completar filas y conserva ceros explícitos", async () => {
  const emisor = { razonSocial: "Proveedor", cuit: "30712345678", condicionIva: "RESPONSABLE_INSCRIPTO", domicilio: null } as const;
  const receptor = { razonSocial: null, cuit: null, condicionIva: null };
  const comprobante = { id: "doc", operacionId: "op", operacionTipo: "COMPRA", tipoDocumento: "FACTURA", clase: "A", numero: "1-1", fecha: "2026-01-01", proveedorId: null, emisor, receptor, codigoAutorizacion: null, vencimientoAutorizacion: null, fechaVencimiento: null, observaciones: null, lineas: [{ tipo: "CONCEPTO", descripcion: "Anterior", percepcionCodigo: null, importe: 12100, ivaAlicuotaId: null }], desgloseIva: null, total: 12100, totalConceptos: 12100, totalPercepciones: 0, createdAt: "", updatedAt: "" } satisfies ComprobanteRecibido;
  const precarga: ComprobanteRecibidoPrecarga = { proveedorId: null, emisor, receptor };
  update.mockResolvedValue(comprobante);
  render(<ComprobanteRecibidoModal open operacionId="op" precarga={precarga} comprobante={comprobante} onClose={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Aplicar alícuota a todos los conceptos"), { target: { value: "6" } });
  const alicuota = screen.getByRole("button", { name: "Alícuota de la línea 1" });
  expect(alicuota).toHaveTextContent("27%");
  fireEvent.click(alicuota);
  fireEvent.click(screen.getByRole("option", { name: "Sin confirmar" }));
  fireEvent.change(screen.getByLabelText("Descripción de la línea 1"), { target: { value: "Corregida" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(update).toHaveBeenCalledWith("doc", expect.objectContaining({ desgloseIva: null, lineas: [expect.objectContaining({ descripcion: "Corregida", ivaAlicuotaId: null })] })));
  update.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Agregar 0%" }));
  expect(screen.getByLabelText("Base neta 3")).toHaveValue(null);
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Completá");
  expect(update).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Quitar" }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(update).toHaveBeenCalledWith("doc", expect.objectContaining({ desgloseIva: null })));
  update.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Agregar 0%" }));
  fireEvent.change(screen.getByLabelText("Base neta 3"), { target: { value: "100" } });
  fireEvent.change(screen.getByLabelText("IVA facturado 3"), { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(update).toHaveBeenCalledWith("doc", expect.objectContaining({ desgloseIva: [{ ivaAlicuotaId: 3, base: 100, iva: 0 }] })));
});

it("al quitar la última fila conserva la tasa de la línea sin recrear el desglose", async () => {
  const emisor = { razonSocial: "Proveedor", cuit: "30712345678", condicionIva: "RESPONSABLE_INSCRIPTO", domicilio: null } as const;
  const receptor = { razonSocial: null, cuit: null, condicionIva: null };
  const comprobante = {
    id: "doc", operacionId: "op", operacionTipo: "COMPRA", tipoDocumento: "FACTURA", clase: "A", numero: "1-1", fecha: "2026-01-01", proveedorId: null,
    emisor, receptor, codigoAutorizacion: null, vencimientoAutorizacion: null, fechaVencimiento: null, observaciones: null,
    lineas: [{ tipo: "CONCEPTO", descripcion: "Anterior", percepcionCodigo: null, importe: 12100, ivaAlicuotaId: 5 }],
    desgloseIva: [{ ivaAlicuotaId: 5, base: 10000, iva: 2100 }], total: 12100, totalConceptos: 12100, totalPercepciones: 0, createdAt: "", updatedAt: "",
  } satisfies ComprobanteRecibido;
  const precarga: ComprobanteRecibidoPrecarga = { proveedorId: null, emisor, receptor };
  update.mockResolvedValue(comprobante);
  render(<ComprobanteRecibidoModal open operacionId="op" precarga={precarga} comprobante={comprobante} onClose={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "Quitar" }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

  await waitFor(() => expect(update).toHaveBeenCalledWith("doc", expect.objectContaining({
    desgloseIva: null,
    lineas: [expect.objectContaining({ ivaAlicuotaId: 5 })],
  })));
});

it("sugiere IVA desde la base neta al corregir una factura A existente", async () => {
  const emisor = { razonSocial: "Proveedor", cuit: "30712345678", condicionIva: "RESPONSABLE_INSCRIPTO", domicilio: null } as const;
  const receptor = { razonSocial: null, cuit: null, condicionIva: null };
  const comprobante = { id: "doc", operacionId: "op", operacionTipo: "COMPRA", tipoDocumento: "FACTURA", clase: "A", numero: "1-1", fecha: "2026-01-01", proveedorId: null, emisor, receptor, codigoAutorizacion: null, vencimientoAutorizacion: null, fechaVencimiento: null, observaciones: null, lineas: [{ tipo: "CONCEPTO", descripcion: "Anterior", percepcionCodigo: null, importe: 12100, ivaAlicuotaId: 5 }], desgloseIva: null, total: 12100, totalConceptos: 12100, totalPercepciones: 0, createdAt: "", updatedAt: "" } satisfies ComprobanteRecibido;
  const precarga: ComprobanteRecibidoPrecarga = { proveedorId: null, emisor, receptor };
  update.mockResolvedValue(comprobante);
  render(<ComprobanteRecibidoModal open operacionId="op" precarga={precarga} comprobante={comprobante} onClose={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "Agregar 21%" }));
  fireEvent.change(screen.getByLabelText("Base neta 5"), { target: { value: "100" } });
  expect(screen.getByLabelText("IVA facturado 5")).toHaveValue(21);
  fireEvent.change(screen.getByLabelText("IVA facturado 5"), { target: { value: "20.99" } });
  fireEvent.change(screen.getByLabelText("Base neta 5"), { target: { value: "200" } });
  expect(screen.getByLabelText("IVA facturado 5")).toHaveValue(20.99);

  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(update).toHaveBeenCalledWith("doc", expect.objectContaining({
    desgloseIva: [{ ivaAlicuotaId: 5, base: 200, iva: 20.99 }],
  })));
});

it("reintenta la factura B sobre la misma compra con la tasa elegida y el importe final", async () => {
  const emisor = { razonSocial: "Proveedor B", cuit: "30712345678", condicionIva: "RESPONSABLE_INSCRIPTO", domicilio: null } as const;
  const receptor = { razonSocial: null, cuit: null, condicionIva: null };
  const comprobante = {
    id: "doc-b",
    operacionId: "op-b",
    operacionTipo: "COMPRA",
    tipoDocumento: "FACTURA",
    clase: "B",
    numero: "1-2",
    fecha: "2026-01-01",
    proveedorId: null,
    emisor,
    receptor,
    codigoAutorizacion: null,
    vencimientoAutorizacion: null,
    fechaVencimiento: null,
    observaciones: null,
    lineas: [{ tipo: "CONCEPTO", descripcion: "Insumos", percepcionCodigo: null, importe: 1210, ivaAlicuotaId: null }],
    desgloseIva: null,
    ivaContenido: null,
    total: 1210,
    totalConceptos: 1210,
    totalPercepciones: 0,
    createdAt: "",
    updatedAt: "",
  } satisfies ComprobanteRecibido;
  const precarga: ComprobanteRecibidoPrecarga = { proveedorId: null, emisor, receptor };
  create.mockClear();
  create.mockResolvedValue(comprobante);
  render(
    <ComprobanteRecibidoModal
      open
      operacionId="op-b"
      precarga={precarga}
      initialInput={comprobante}
      initialError="Línea 1: elegí la alícuota de IVA para una factura B"
      idempotencyKey="intento-anterior"
      onClose={vi.fn()}
    />,
  );

  expect(screen.queryByText("Desglose de IVA confirmado")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("IVA contenido informado")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Guardar documento" }));
  expect(create).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("elegí la alícuota");

  fireEvent.click(screen.getByRole("button", { name: "Alícuota de la línea 1" }));
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "10,5%" }));
  fireEvent.click(screen.getByTestId("operacion-factura-agregar-percepcion"));
  const percepcion = screen.getByLabelText("Percepción 1");
  fireEvent.change(percepcion, { target: { value: "Ganancias" } });
  fireEvent.click(screen.getByText("Ganancias"));
  fireEvent.change(screen.getByLabelText("Importe de la percepción 1"), { target: { value: "15,50" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar documento" }));

  await waitFor(() => expect(create).toHaveBeenCalledWith("op-b", expect.objectContaining({
    clase: "B",
    desgloseIva: null,
    ivaContenido: null,
    lineas: [
      expect.objectContaining({ descripcion: "Insumos", importe: 1210, ivaAlicuotaId: 4 }),
      expect.objectContaining({ tipo: "PERCEPCION", percepcionCodigo: "GANANCIAS", importe: 15.5, ivaAlicuotaId: null }),
    ],
  }), "intento-anterior"));
});

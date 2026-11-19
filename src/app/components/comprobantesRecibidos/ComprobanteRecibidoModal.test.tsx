import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { ComprobanteRecibido, ComprobanteRecibidoPrecarga } from "@/lib/comprobantesRecibidos/types";
import ComprobanteRecibidoModal from "./ComprobanteRecibidoModal";

const { update } = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/app/providers/ToastProvider", () => ({ useToast: () => ({ success: vi.fn() }) }));
vi.mock("@/clients/comprobantesRecibidosClient", () => ({ comprobantesRecibidosClient: { update } }));

it("mantiene valores ausentes, exige completar filas y conserva ceros explícitos", async () => {
  const emisor = { razonSocial: "Proveedor", cuit: "30712345678", condicionIva: "RESPONSABLE_INSCRIPTO", domicilio: null } as const;
  const receptor = { razonSocial: null, cuit: null, condicionIva: null };
  const comprobante = { id: "doc", operacionId: "op", operacionTipo: "COMPRA", tipoDocumento: "FACTURA", clase: "A", numero: "1-1", fecha: "2026-01-01", proveedorId: null, emisor, receptor, codigoAutorizacion: null, vencimientoAutorizacion: null, fechaVencimiento: null, observaciones: null, lineas: [{ tipo: "CONCEPTO", descripcion: "Anterior", percepcionCodigo: null, importe: 12100, ivaAlicuotaId: null }], desgloseIva: null, total: 12100, totalConceptos: 12100, totalPercepciones: 0, createdAt: "", updatedAt: "" } satisfies ComprobanteRecibido;
  const precarga: ComprobanteRecibidoPrecarga = { proveedorId: null, emisor, receptor };
  update.mockResolvedValue(comprobante);
  render(<ComprobanteRecibidoModal open operacionId="op" precarga={precarga} comprobante={comprobante} onClose={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Aplicar alícuota a todos los conceptos"), { target: { value: "6" } });
  expect(screen.getByLabelText("Alícuota de la línea 1")).toHaveValue("6");
  fireEvent.change(screen.getByLabelText("Alícuota de la línea 1"), { target: { value: "" } });
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

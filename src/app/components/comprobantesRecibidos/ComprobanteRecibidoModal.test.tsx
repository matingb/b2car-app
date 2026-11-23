import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { ComprobanteRecibido, ComprobanteRecibidoPrecarga } from "@/lib/comprobantesRecibidos/types";
import ComprobanteRecibidoModal from "./ComprobanteRecibidoModal";
import ComprobanteRecibidoOperacionModal from "./ComprobanteRecibidoOperacionModal";

const { create, update, listByOperacion, crearTurnoVencimiento } = vi.hoisted(() => ({
  create: vi.fn(), update: vi.fn(), listByOperacion: vi.fn(), crearTurnoVencimiento: vi.fn(),
}));
vi.mock("@/app/providers/ToastProvider", () => ({ useToast: () => ({ success: vi.fn() }) }));
vi.mock("@/clients/comprobantesRecibidosClient", () => ({
  comprobantesRecibidosClient: { create, update, listByOperacion, crearTurnoVencimiento },
}));

const facturaA = {
  id: "doc",
  operacionId: "op",
  operacionTipo: "COMPRA",
  tipoDocumento: "FACTURA",
  clase: "A",
  numero: "1-1",
  fecha: "2026-01-01",
  proveedorId: null,
  emisor: { razonSocial: "Proveedor", cuit: "30712345678", condicionIva: "RESPONSABLE_INSCRIPTO", domicilio: null },
  receptor: { razonSocial: null, cuit: null, condicionIva: null },
  codigoAutorizacion: null,
  vencimientoAutorizacion: null,
  fechaVencimiento: null,
  observaciones: null,
  lineas: [{ tipo: "CONCEPTO", descripcion: "Filtro (x2)", percepcionCodigo: null, importe: 241.99, ivaAlicuotaId: 5 }],
  desgloseIva: [{ ivaAlicuotaId: 5, base: 200, iva: 41.99 }],
  total: 241.99,
  totalConceptos: 241.99,
  totalPercepciones: 0,
  createdAt: "",
  updatedAt: "",
} satisfies ComprobanteRecibido;

it("edita una factura A con la misma grilla y el mismo resumen que el reintento", async () => {
  update.mockReset().mockResolvedValue(facturaA);
  render(<ComprobanteRecibidoModal open operacionId="op" precarga={facturaA} comprobante={facturaA} onClose={vi.fn()} />);

  expect(screen.queryByText("Desglose de IVA confirmado")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Aplicar alícuota a todos los conceptos")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Descripción de la línea 1")).toHaveValue("Filtro");
  expect(screen.getByLabelText("Cantidad de la línea 1")).toHaveValue(2);
  expect(screen.getByLabelText("Precio unitario de la línea 1")).toHaveValue("100");
  expect(screen.getByRole("group", { name: "Totales de IVA por alícuota" })).toHaveTextContent("41,99");

  fireEvent.change(screen.getByLabelText("Cantidad de la línea 1"), { target: { value: "3" } });
  const resumenIva = screen.getByRole("group", { name: "Totales de IVA por alícuota" });
  expect(resumenIva).toHaveTextContent("Total IVA 21%");
  expect(resumenIva).toHaveTextContent("$63");
  expect(screen.getByTestId("comprobante-recibido-totales")).toHaveTextContent("Total del documento: $363");
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

  await waitFor(() => expect(update).toHaveBeenCalledWith("doc", expect.objectContaining({
    desgloseIva: [{ ivaAlicuotaId: 5, base: 300, iva: 63 }],
    lineas: [expect.objectContaining({ descripcion: "Filtro (x3)", importe: 363, ivaAlicuotaId: 5 })],
  })));
});

it("conserva los importes y el IVA guardados al corregir el número de la factura", async () => {
  update.mockReset().mockResolvedValue(facturaA);
  render(<ComprobanteRecibidoModal open operacionId="op" precarga={facturaA} comprobante={facturaA} onClose={vi.fn()} />);

  fireEvent.change(screen.getByRole("textbox", { name: /Número de factura/ }), { target: { value: "1-2" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

  await waitFor(() => expect(update).toHaveBeenCalledWith("doc", expect.objectContaining({
    numero: "1-2",
    desgloseIva: facturaA.desgloseIva,
    lineas: facturaA.lineas,
  })));
});

it("mantiene un importe final sin inventar IVA para un concepto histórico sin alícuota", async () => {
  const comprobante: ComprobanteRecibido = {
    ...facturaA,
    lineas: [{ ...facturaA.lineas[0], descripcion: "Filtro", importe: 121, ivaAlicuotaId: null }],
    desgloseIva: null,
    total: 121,
    totalConceptos: 121,
  };
  update.mockReset().mockResolvedValue(comprobante);
  render(<ComprobanteRecibidoModal open operacionId="op" precarga={comprobante} comprobante={comprobante} onClose={vi.fn()} />);

  expect(screen.getByLabelText("Precio unitario de la línea 1")).toHaveValue("121");
  expect(screen.getByRole("button", { name: "Alícuota de la línea 1" })).toHaveTextContent("Sin confirmar");
  expect(screen.queryByRole("group", { name: "Totales de IVA por alícuota" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Descripción de la línea 1"), { target: { value: "Corregida" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

  await waitFor(() => expect(update).toHaveBeenCalledWith("doc", expect.objectContaining({
    desgloseIva: null,
    lineas: [expect.objectContaining({ descripcion: "Corregida", importe: 121, ivaAlicuotaId: null })],
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

  expect(screen.queryByLabelText("Aplicar alícuota a todos los conceptos")).not.toBeInTheDocument();
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

const precargaCompra: ComprobanteRecibidoPrecarga = {
  proveedorId: null,
  emisor: { razonSocial: "Proveedor", cuit: "30712345678", condicionIva: "RESPONSABLE_INSCRIPTO", domicilio: null },
  receptor: { razonSocial: null, cuit: null, condicionIva: null },
};

it("calcula el desglose por alícuota al adjuntar una factura A a una compra existente", async () => {
  listByOperacion.mockResolvedValue({ precarga: precargaCompra });
  create.mockReset().mockResolvedValue(facturaA);
  const onClose = vi.fn();
  render(<ComprobanteRecibidoOperacionModal open operacionId="compra" onClose={onClose} />);

  await screen.findByTestId("comprobante-recibido-form");
  fireEvent.click(screen.getByTestId("comprobante-recibido-clase-A"));
  expect(screen.queryByLabelText("Aplicar alícuota a todos los conceptos")).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: /Número de factura/ }), { target: { value: "1-2" } });
  fireEvent.change(screen.getByLabelText("Descripción de la línea 1"), { target: { value: "Filtro" } });
  fireEvent.change(screen.getByLabelText("Cantidad de la línea 1"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Precio unitario de la línea 1"), { target: { value: "100" } });
  fireEvent.click(screen.getByTestId("comprobante-recibido-agregar-concepto"));
  fireEvent.change(screen.getByLabelText("Descripción de la línea 2"), { target: { value: "Cargo" } });
  fireEvent.change(screen.getByLabelText("Precio unitario de la línea 2"), { target: { value: "60" } });
  fireEvent.click(screen.getByRole("button", { name: "Alícuota de la línea 2" }));
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "0%" }));

  const desglose = within(screen.getByRole("group", { name: "Totales de IVA por alícuota" }));
  expect(desglose.getByText("Total IVA 21%")).toBeInTheDocument();
  expect(desglose.getByText("Total IVA 0%")).toBeInTheDocument();
  expect(screen.getByTestId("comprobante-recibido-totales")).toHaveTextContent("Total del documento: $302");
  fireEvent.click(screen.getByRole("button", { name: "Guardar documento" }));

  await waitFor(() => expect(create).toHaveBeenCalledWith("compra", expect.objectContaining({
    desgloseIva: [{ ivaAlicuotaId: 3, base: 60, iva: 0 }, { ivaAlicuotaId: 5, base: 200, iva: 42 }],
    lineas: [
      expect.objectContaining({ descripcion: "Filtro (x2)", importe: 242, ivaAlicuotaId: 5 }),
      expect.objectContaining({ descripcion: "Cargo", importe: 60, ivaAlicuotaId: 3 }),
    ],
  }), expect.any(String)));
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(screen.queryByRole("dialog", { name: "Vencimiento de factura" })).not.toBeInTheDocument();
});

it("permite reintentar el recordatorio tras adjuntar una factura sin volver a guardarla", async () => {
  const factura = { ...facturaA, fechaVencimiento: "2026-02-01" };
  create.mockReset().mockResolvedValue(factura);
  crearTurnoVencimiento.mockReset()
    .mockRejectedValueOnce(new Error("Calendario no disponible"))
    .mockResolvedValueOnce(undefined);
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(<ComprobanteRecibidoOperacionModal
    open
    operacionId={factura.operacionId}
    initialInput={factura}
    onSaved={onSaved}
    onClose={onClose}
  />);

  fireEvent.click(screen.getByRole("button", { name: "Guardar documento" }));
  const dialog = await screen.findByRole("dialog", { name: "Vencimiento de factura" });
  expect(dialog).toHaveTextContent("01/02/2026");
  expect(onSaved).toHaveBeenCalledWith(factura);
  expect(onClose).not.toHaveBeenCalled();
  expect(crearTurnoVencimiento).not.toHaveBeenCalled();

  const agregar = within(dialog).getByRole("button", { name: "Agregar al calendario" });
  fireEvent.click(agregar);
  expect(await screen.findByRole("alert")).toHaveTextContent("Calendario no disponible");
  fireEvent.click(agregar);

  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(crearTurnoVencimiento.mock.calls).toEqual([["doc"], ["doc"]]);
  expect(create).toHaveBeenCalledOnce();
});

it("abre el mismo formulario tras un duplicado con los datos originales y reutiliza la clave", async () => {
  listByOperacion.mockClear();
  create.mockReset().mockResolvedValue({});
  const initialInput = {
    ...precargaCompra,
    tipoDocumento: "FACTURA" as const,
    clase: "A" as const,
    numero: "0001-00000002",
    fecha: "2026-01-01",
    codigoAutorizacion: null,
    vencimientoAutorizacion: null,
    fechaVencimiento: null,
    observaciones: null,
    lineas: [{ tipo: "CONCEPTO" as const, descripcion: "Filtro (x3)", percepcionCodigo: null, importe: 331.5, ivaAlicuotaId: 4 }],
    desgloseIva: [{ ivaAlicuotaId: 4, base: 300, iva: 31.5 }],
  };
  render(<ComprobanteRecibidoOperacionModal
    open
    operacionId="compra"
    initialInput={initialInput}
    initialConceptos={[{ key: "filtro", descripcion: "Filtro", cantidad: 3, unitario: 100, importe: 300, ivaAlicuotaId: 4 }]}
    initialError="Ya existe una factura con ese número"
    idempotencyKey="intento-anterior"
    onClose={vi.fn()}
  />);

  expect(listByOperacion).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog", { name: "Nueva factura recibida" })).toBeInTheDocument();
  const aviso = screen.getByRole("alert");
  expect(aviso).toHaveTextContent("Ya existe una factura con ese número");
  expect(screen.getByTestId("comprobante-recibido-form").lastElementChild).toBe(aviso);
  const cancelar = screen.getByRole("button", { name: "Cancelar" });
  expect(aviso.compareDocumentPosition(cancelar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByLabelText("Cantidad de la línea 1")).toHaveValue(3);
  expect(screen.getByLabelText("Precio unitario de la línea 1")).toHaveValue("100");
  expect(screen.getByRole("button", { name: "Alícuota de la línea 1" })).toHaveTextContent("10,5%");
  expect(screen.getByRole("group", { name: "Totales de IVA por alícuota" })).toHaveTextContent("31,50");
  fireEvent.change(screen.getByRole("textbox", { name: /Número de factura/ }), { target: { value: "1-3" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar documento" }));

  await waitFor(() => expect(create).toHaveBeenCalledWith("compra", expect.objectContaining({
    numero: "1-3",
    desgloseIva: initialInput.desgloseIva,
    lineas: initialInput.lineas,
  }), "intento-anterior"));
});

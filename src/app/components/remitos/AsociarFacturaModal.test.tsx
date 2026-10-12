import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RemitoDetalle } from "@/lib/remitos/types";
import AsociarFacturaModal from "./AsociarFacturaModal";

const fetchMock = vi.fn();
const FACTURA_ID = "44444444-4444-4444-8444-444444444444";

function respuesta(data: unknown, status = 200) {
  return new Response(JSON.stringify(status === 200 ? { data, error: null } : { error: data }), { status });
}

const remito = {
  id: "remito-1",
  clase: "X",
  numeroVisible: "X 00001-00000003",
  ambiente: "HOMOLOGACION",
  destinatario: { clienteId: null, nombre: "Juan", domicilio: null, tipoDocumento: 96, numeroDocumento: "30111222", condicionIvaReceptorId: null },
  lineas: [
    { id: "r1", ordinal: 1, codigo: "FIL", descripcion: "Filtro", observaciones: null, cantidad: 2, facturaLineaId: null },
    { id: "r2", ordinal: 2, codigo: null, descripcion: "Mano de obra", observaciones: null, cantidad: 1, facturaLineaId: null },
  ],
} as unknown as RemitoDetalle;

const facturas = {
  items: [{
    id: FACTURA_ID,
    estado: "AUTORIZADA",
    ambiente: "HOMOLOGACION",
    documentoTipo: "FACTURA",
    claseComprobante: "C",
    puntoVenta: 1,
    numeroComprobante: 123,
    fechaComprobante: "2026-10-01",
    receptorNombre: "Cliente Factura",
    receptorDocumento: "20111222",
    total: 99999,
  }],
  page: 1,
  pageSize: 10,
  total: 1,
};

function lineasFactura(disponibleFiltro: number) {
  return {
    remitos: [],
    lineas: [
      { id: "l1", ordinal: 1, origen: "REPUESTO", codigo: "FIL", descripcion: "Filtro", cantidadFacturada: 5, cantidadRemitida: 5 - disponibleFiltro, cantidadDisponible: disponibleFiltro },
      { id: "l2", ordinal: 2, origen: "SERVICIO", codigo: null, descripcion: "Mano de obra", cantidadFacturada: 1, cantidadRemitida: 0, cantidadDisponible: 1 },
    ],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

async function elegirFactura() {
  const opcion = await screen.findByTestId(`asociar-factura-${FACTURA_ID}`);
  expect(fetchMock.mock.calls[0][0]).toContain("documentoTipo=FACTURA");
  expect(fetchMock.mock.calls[0][0]).toContain("estado=AUTORIZADA");
  expect(fetchMock.mock.calls[0][0]).toContain("ambiente=HOMOLOGACION");
  fireEvent.click(opcion);
}

describe("AsociarFacturaModal", () => {
  it("busca facturas autorizadas sin mostrar importes, sugiere el mapeo y envía la asociación", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock
      .mockResolvedValueOnce(respuesta(facturas))
      .mockResolvedValueOnce(respuesta(lineasFactura(5)))
      .mockResolvedValueOnce(respuesta({ id: "remito-1" }));
    const onAssociated = vi.fn();
    render(<AsociarFacturaModal open remito={remito} onClose={vi.fn()} onAssociated={onAssociated} />);

    const opcion = await screen.findByTestId(`asociar-factura-${FACTURA_ID}`);
    expect(opcion).toHaveTextContent("Factura C 00001-00000123");
    expect(document.body.textContent).not.toMatch(/\$|99\.?999/);
    await elegirFactura();

    await waitFor(() => expect(screen.getByTestId("asociar-mapeo-r1")).toHaveTextContent("FIL · Filtro"));
    expect(screen.getByTestId("asociar-mapeo-r2")).toHaveTextContent("Mano de obra");
    expect(screen.getByTestId("asociar-documento-distinto")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\$|99\.?999/);

    const submit = screen.getByTestId("modal-submit");
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    const confirmTitle = await screen.findByText("Confirmar asociación");
    expect(screen.getByText(/no puede deshacerse/)).toBeInTheDocument();
    fireEvent.click(within(confirmTitle.closest("[role=dialog]") as HTMLElement).getByRole("button", { name: "Asociar" }));

    await waitFor(() => expect(onAssociated).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[2];
    expect(url).toBe("/api/remitos/remito-1/factura");
    expect(JSON.parse(String(init.body))).toEqual({
      facturaId: FACTURA_ID,
      lineas: [{ remitoLineaId: "r1", facturaLineaId: "l1" }, { remitoLineaId: "r2", facturaLineaId: "l2" }],
    });
  });

  it("bloquea la asociación cuando el mapeo excede lo disponible", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock
      .mockResolvedValueOnce(respuesta(facturas))
      .mockResolvedValueOnce(respuesta(lineasFactura(1)));
    render(<AsociarFacturaModal open remito={remito} onClose={vi.fn()} onAssociated={vi.fn()} />);
    await elegirFactura();

    await waitFor(() => expect(screen.getByTestId("asociar-mapeo-r1")).toHaveTextContent("Seleccioná una línea"));
    expect(screen.getByTestId("modal-submit")).toBeDisabled();

    fireEvent.click(screen.getByTestId("asociar-mapeo-r1"));
    fireEvent.click(await screen.findByTestId("asociar-mapeo-r1-option-l1"));

    expect(await screen.findByText("Supera la cantidad disponible de la línea por 1.")).toBeInTheDocument();
    expect(screen.getByTestId("modal-submit")).toBeDisabled();
  });
});

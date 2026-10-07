import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SheetProvider } from "@/app/providers/SheetProvider";
import { renderWithProviders } from "@/tests/testUtils";
import RemitoDetailPage from "./page";

const REMITO_ID = "33333333-3333-4333-8333-333333333333";
const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: REMITO_ID }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

const detalle = {
  id: REMITO_ID,
  clase: "R",
  puntoEmision: 1,
  numero: 8,
  numeroVisible: "R 00001-00000008",
  fechaEmision: "2026-10-06",
  ambiente: "PRODUCCION",
  destinatarioNombre: "Juan Pérez",
  destinatarioDocumento: "DNI 30111222",
  tipoComprobante: 91,
  emisor: {
    razonSocial: "Taller SRL", nombreFantasia: null, cuit: "20123456786", domicilio: "Calle 1", ingresosBrutos: null,
    inicioActividades: "2020-01-01", condicionIvaEmisor: "MONOTRIBUTISTA", condicionIva: "Monotributista",
  },
  destinatario: {
    clienteId: null, nombre: "Juan Pérez", domicilio: "Calle 2", tipoDocumento: 96, numeroDocumento: "30111222",
    condicionIvaReceptorId: 5, condicionIva: "Consumidor final",
  },
  transportista: null,
  cai: "71234567890123",
  caiVencimiento: "2026-12-31",
  impresion: { autoimpresor: true, numeroDesde: 1, numeroHasta: 100, inicioActividades: null, imprenta: null },
  observaciones: "Entrega parcial",
  lineas: [{ id: "rl1", ordinal: 1, codigo: "FIL", descripcion: "Filtro", observaciones: null, cantidad: 1.5, facturaLineaId: "l1" }],
  // Aunque la respuesta trajera importes de la factura, la pantalla no debe mostrarlos.
  factura: { id: "f1", label: "Factura C 00001-00000123", fechaComprobante: "2026-10-01", receptorNombre: null, receptorDocumento: null, total: 99999 },
  facturaAsociadaAt: "2026-10-06T12:00:00Z",
  createdAt: "2026-10-06T12:00:00Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function renderPage(canManage: boolean, overrides: Record<string, unknown> = {}) {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...detalle, ...overrides }, canManage, error: null })));
  return renderWithProviders(<SheetProvider><RemitoDetailPage /></SheetProvider>);
}

describe("RemitoDetailPage", () => {
  it("muestra snapshots, ítems y CAI sin importes, con acceso a la factura", async () => {
    renderPage(true);

    expect(await screen.findByText("REMITO R")).toBeInTheDocument();
    expect(screen.getByText("DOCUMENTO NO VÁLIDO COMO FACTURA")).toBeInTheDocument();
    expect(screen.getAllByText("R 00001-00000008").length).toBeGreaterThan(0);
    expect(screen.getByText("Filtro")).toBeInTheDocument();
    expect(screen.getByText("1,5")).toBeInTheDocument();
    expect(screen.getAllByText("71234567890123").length).toBeGreaterThan(0);
    expect(screen.getByText("00001-00000001 al 00001-00000100")).toBeInTheDocument();
    expect(screen.getByTestId("remito-ver-factura")).toHaveAttribute("href", "/facturacion/f1");
    expect(screen.queryByTestId("remito-asociar-factura")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\$|99\.?999|importe|subtotal/i);
  });

  it("ofrece asociar a factura solo con permiso y si no tiene factura", async () => {
    renderPage(true, { factura: null, facturaAsociadaAt: null });
    expect(await screen.findByTestId("remito-asociar-factura")).toBeInTheDocument();
    expect(screen.getByText("Sin factura asociada")).toBeInTheDocument();
  });

  it("oculta la asociación sin facturas:edit", async () => {
    renderPage(false, { factura: null, facturaAsociadaAt: null });
    expect(await screen.findByText("REMITO R")).toBeInTheDocument();
    expect(screen.queryByTestId("remito-asociar-factura")).not.toBeInTheDocument();
  });
});

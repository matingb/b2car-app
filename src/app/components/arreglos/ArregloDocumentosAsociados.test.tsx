import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/logger";
import ArregloDocumentosAsociados from "./ArregloDocumentosAsociados";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const ARREGLO_ID = "55555555-5555-4555-8555-555555555555";
const fetchMock = vi.fn();

function respuesta(data: unknown) {
  return new Response(JSON.stringify({ data, error: null }), { status: 200 });
}

const remito = {
  id: "remito-1", clase: "X", puntoEmision: 1, numero: 3, numeroVisible: "X 00001-00000003", fechaEmision: "2026-10-06",
  ambiente: "HOMOLOGACION", destinatarioNombre: "Juan", destinatarioDocumento: null, arregloId: ARREGLO_ID, operacionId: null, factura: null,
};
const factura = {
  id: "factura-1", estado: "AUTORIZADA", documentoTipo: "FACTURA", claseComprobante: "C", puntoVenta: 1, numeroComprobante: 123,
  fechaComprobante: "2026-10-05",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
  push.mockReset();
});

describe("ArregloDocumentosAsociados", () => {
  it("lista facturas y remitos del arreglo con enlace a su detalle", async () => {
    fetchMock.mockResolvedValueOnce(respuesta([
      { tipo: "REMITO", id: remito.id, fecha: remito.fechaEmision, remito },
      { tipo: "FISCAL", id: factura.id, fecha: factura.fechaComprobante, factura },
    ]));
    vi.stubGlobal("fetch", fetchMock);

    render(<ArregloDocumentosAsociados arregloId={ARREGLO_ID} />);

    expect(await screen.findByRole("heading", { name: "Documentos asociados" })).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: /Remito X/ }));
    expect(push).toHaveBeenLastCalledWith("/remitos/remito-1");
    fireEvent.keyDown(screen.getByRole("link", { name: /Factura C/ }), { key: "Enter" });
    expect(push).toHaveBeenLastCalledWith("/facturacion/factura-1");
    expect(fetchMock).toHaveBeenCalledWith(`/api/arreglos/${ARREGLO_ID}/documentos`, expect.anything());
  });

  it("muestra los títulos mientras carga y oculta la sección si el arreglo no tiene documentos", async () => {
    let resolver: (value: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => { resolver = resolve; }));
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<ArregloDocumentosAsociados arregloId={ARREGLO_ID} />);

    expect(screen.getByRole("heading", { name: "Documentos asociados" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Cargando documentos asociados" })).toBeTruthy();

    resolver(respuesta([]));
    await waitFor(() => expect(container.innerHTML).toBe(""));
  });

  it("no muestra la sección si falla la carga", async () => {
    const logError = vi.spyOn(logger, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "boom" }), { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<ArregloDocumentosAsociados arregloId={ARREGLO_ID} />);

    await waitFor(() => expect(logError).toHaveBeenCalled());
    await waitFor(() => expect(container.innerHTML).toBe(""));
  });
});

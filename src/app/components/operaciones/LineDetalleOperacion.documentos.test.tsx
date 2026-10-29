import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Operacion } from "@/model/types";
import LineDetalleOperacion from "./LineDetalleOperacion";
import { renderWithProviders as render } from "@/tests/testUtils";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const OPERACION_ID = "66666666-6666-4666-8666-666666666666";
const fetchMock = vi.fn();

const operacion = {
  id: OPERACION_ID,
  tipo: "VENTA",
  taller_id: "taller-1",
  fecha: "2026-10-06T12:00:00Z",
  created_at: "2026-10-06T12:00:00Z",
  lineas: [],
} as unknown as Operacion;

const remito = {
  id: "remito-1", clase: "R", puntoEmision: 1, numero: 8, numeroVisible: "R 00001-00000008", fechaEmision: "2026-10-06",
  ambiente: "HOMOLOGACION", destinatarioNombre: "Juan", destinatarioDocumento: null, arregloId: null, operacionId: OPERACION_ID, factura: null,
};

function renderLinea(props: { expanded: boolean; showDocumentos: boolean; onToggle?: () => void }) {
  return render(
    <LineDetalleOperacion
      operacion={operacion}
      tipoLabel="Venta"
      tipoIcon={null}
      tipoColor="green"
      tipoBg="white"
      tallerLabel="Taller"
      stocksById={{}}
      onToggle={props.onToggle ?? vi.fn()}
      expanded={props.expanded}
      showDocumentos={props.showDocumentos}
    />,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  push.mockReset();
});

describe("LineDetalleOperacion - documentos asociados", () => {
  it("no consulta documentos mientras la línea está colapsada", () => {
    vi.stubGlobal("fetch", fetchMock);
    renderLinea({ expanded: false, showDocumentos: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("al expandir muestra los documentos de la venta y el enlace no colapsa la línea", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      data: [{ tipo: "REMITO", id: remito.id, fecha: remito.fechaEmision, remito }],
      error: null,
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const onToggle = vi.fn();

    renderLinea({ expanded: true, showDocumentos: true, onToggle });

    const link = await screen.findByRole("link", { name: /Remito R/ });
    expect(screen.getByRole("region", { name: "Documentos asociados" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(`/api/operaciones/${OPERACION_ID}/documentos`, expect.anything());
    fireEvent.click(link);
    expect(push).toHaveBeenCalledWith("/remitos/remito-1");
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("al expandir muestra el título mientras carga y lo oculta si la venta no tiene documentos", async () => {
    let resolver: (value: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => { resolver = resolve; }));
    vi.stubGlobal("fetch", fetchMock);

    renderLinea({ expanded: true, showDocumentos: true });

    expect(await screen.findByRole("region", { name: "Documentos asociados" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Cargando documentos asociados" })).toBeTruthy();

    resolver(new Response(JSON.stringify({ data: [], error: null }), { status: 200 }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Documentos asociados" })).toBeNull());
  });

  it("no consulta documentos si la línea no los muestra", () => {
    vi.stubGlobal("fetch", fetchMock);
    renderLinea({ expanded: true, showDocumentos: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Documentos asociados")).toBeNull();
  });

  it("aplica ellipsis y nowrap al titulo de la operacion", () => {
    const { container } = renderLinea({ expanded: false, showDocumentos: false });
    const h4 = container.querySelector("h4");
    expect(h4).toHaveStyle({
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    });
  });
});


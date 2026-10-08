import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/tests/testUtils";
import RemitoForm from "./RemitoForm";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const fetchMock = vi.fn();
const REMITO_ID = "33333333-3333-4333-8333-333333333333";

function respuesta(data: unknown, status = 200) {
  return new Response(JSON.stringify(status < 400 ? { data, error: null } : { error: data, code: "VALIDATION" }), { status });
}

const preflight = {
  ambiente: "HOMOLOGACION",
  emisor: { completo: true, faltantes: [] },
  tipos: {
    R: { emitible: false, motivos: ["Falta configurar el CAI.", "Falta el punto de emisión."], proximoNumeroVisible: null },
    X: { emitible: true, motivos: [], proximoNumeroVisible: "X 00001-00000001" },
  },
  factura: null,
  arreglo: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function renderForm(onEmitted = vi.fn()) {
  renderWithProviders(<RemitoForm facturaId={null} onEmitted={onEmitted} />);
  return onEmitted;
}

async function completarRemitoX() {
  fireEvent.click(await screen.findByTestId("remito-tipo-X"));
  fireEvent.change(screen.getByLabelText(/Apellido y nombre/), { target: { value: "Juan Pérez" } });
  fireEvent.change(screen.getByLabelText("Descripción del ítem 1"), { target: { value: "Neumático" } });
}

async function confirmarEmision() {
  fireEvent.click(screen.getByTestId("remito-emitir"));
  const titulo = await screen.findByText("Emitir Remito X");
  fireEvent.click(within(titulo.closest("[role=dialog]") as HTMLElement).getByRole("button", { name: "Emitir" }));
}

describe("RemitoForm", () => {
  it("con R no emitible muestra los motivos y bloquea la emisión sin deshabilitar ni cambiar el tipo", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(respuesta(preflight));
    renderForm();

    const r = await screen.findByTestId("remito-tipo-R");
    expect(r).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("remito-tipo-X")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("remito-emitir")).toBeDisabled();
    expect(screen.getByTestId("remito-blocking-reason")).toHaveTextContent("Seleccioná el tipo de remito.");

    fireEvent.click(r);
    fireEvent.change(screen.getByLabelText(/Apellido y nombre/), { target: { value: "Juan" } });
    fireEvent.change(screen.getByLabelText("Descripción del ítem 1"), { target: { value: "Rueda" } });

    expect(screen.getByTestId("remito-r-motivos")).toHaveTextContent("Falta configurar el CAI.");
    expect(screen.getByTestId("remito-r-motivos")).toHaveTextContent("Falta el punto de emisión.");
    expect(screen.getByTestId("remito-tipo-R")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("remito-tipo-R")).toBeEnabled();
    expect(screen.getByTestId("remito-tipo-X")).toBeEnabled();
    expect(screen.getByTestId("remito-emitir")).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("emite con idempotencyKey y la reutiliza al reintentar tras un error", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock
      .mockResolvedValueOnce(respuesta(preflight))
      .mockResolvedValueOnce(respuesta("El número de remito ya fue utilizado.", 409))
      .mockResolvedValueOnce(respuesta({ id: REMITO_ID }, 201));
    const onEmitted = renderForm();

    await completarRemitoX();
    expect(screen.getByTestId("remito-emitir")).toBeEnabled();
    await confirmarEmision();
    expect(await screen.findByText("El número de remito ya fue utilizado.")).toBeInTheDocument();
    expect(onEmitted).not.toHaveBeenCalled();

    await confirmarEmision();
    await waitFor(() => expect(onEmitted).toHaveBeenCalledWith(REMITO_ID));

    const [primerUrl, primerInit] = fetchMock.mock.calls[1];
    const [, segundoInit] = fetchMock.mock.calls[2];
    const primero = JSON.parse(String(primerInit.body));
    const segundo = JSON.parse(String(segundoInit.body));
    expect(primerUrl).toBe("/api/remitos");
    expect(primero).toEqual({
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
      clase: "X",
      arregloId: null,
      facturaId: null,
      destinatario: {
        clienteId: null, nombre: "Juan Pérez", domicilio: null, tipoDocumento: null, numeroDocumento: null, condicionIvaReceptorId: null,
      },
      transportista: null,
      observaciones: null,
      lineas: [{ facturaLineaId: null, codigo: null, descripcion: "Neumático", observaciones: null, cantidad: 1 }],
    });
    expect(segundo.idempotencyKey).toBe(primero.idempotencyKey);
  });

  it("bloquea la emisión cuando faltan datos fiscales del emisor", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(respuesta({ ...preflight, emisor: { completo: false, faltantes: ["CUIT"] } }));
    renderForm();

    expect(await screen.findByText(/Faltan datos fiscales del emisor/)).toBeInTheDocument();
    await completarRemitoX();
    expect(screen.getByTestId("remito-emitir")).toBeDisabled();
  });

  it("precarga un detalle editable con referencia cuando el remito sale de una factura", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock
      .mockResolvedValueOnce(respuesta({
        ...preflight,
        factura: {
          id: "44444444-4444-4444-8444-444444444444",
          label: "Factura C 00001-00000123",
          fechaComprobante: "2026-10-01",
          destinatario: { clienteId: null, nombre: "Cliente Factura", domicilio: "Calle 1", tipoDocumento: 96, numeroDocumento: "30111222", condicionIvaReceptorId: 5 },
          lineas: [{ id: "l1", ordinal: 1, origen: "REPUESTO", codigo: "FIL", descripcion: "Filtro", cantidadFacturada: 2, cantidadRemitida: 0, cantidadDisponible: 2 }],
        },
        arreglo: null,
      }))
      .mockResolvedValueOnce(respuesta({ id: REMITO_ID }));
    renderWithProviders(<RemitoForm facturaId="44444444-4444-4444-8444-444444444444" onEmitted={vi.fn()} />);

    expect(await screen.findByText("Factura C 00001-00000123")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/remitos/preflight?facturaId=44444444-4444-4444-8444-444444444444");
    expect(screen.getByLabelText(/Apellido y nombre/)).toHaveValue("Cliente Factura");
    expect(screen.getByLabelText("Descripción del ítem 1")).toHaveValue("Filtro");
    expect(screen.getByLabelText("Cantidad del ítem 1")).toHaveValue(2);
    fireEvent.change(screen.getByLabelText("Descripción del ítem 1"), { target: { value: "Caja de repuestos entregados" } });
    fireEvent.click(screen.getByTestId("remito-tipo-X"));
    await confirmarEmision();
    const payload = JSON.parse(String(fetchMock.mock.calls[1][1].body));
    expect(payload.lineas).toEqual([{
      facturaLineaId: "l1", codigo: "FIL", descripcion: "Caja de repuestos entregados", observaciones: null, cantidad: 2,
    }]);
    expect(document.body.textContent).not.toMatch(/\$|precio|importe/i);
  });

  it("precarga bienes desde un arreglo y emite conservando el origen y el detalle propio", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock
      .mockResolvedValueOnce(respuesta({
        ...preflight,
        arreglo: {
          id: "55555555-5555-4555-8555-555555555555",
          label: "Arreglo N° 42",
          destinatario: { clienteId: null, nombre: "Cliente del arreglo", domicilio: "Calle 2", tipoDocumento: null, numeroDocumento: null, condicionIvaReceptorId: null },
          lineas: [{ codigo: "REP-1", descripcion: "Pastillas de freno", cantidad: 3 }],
        },
      }))
      .mockResolvedValueOnce(respuesta({ id: REMITO_ID }));
    const onEmitted = vi.fn();
    renderWithProviders(<RemitoForm facturaId={null} arregloId="55555555-5555-4555-8555-555555555555" onEmitted={onEmitted} />);

    expect(await screen.findByText("Arreglo N° 42")).toBeInTheDocument();
    expect(screen.getByLabelText("Descripción del ítem 1")).toHaveValue("Pastillas de freno");
    fireEvent.click(screen.getByTestId("remito-tipo-X"));
    await confirmarEmision();

    expect(fetchMock.mock.calls[0][0]).toBe("/api/remitos/preflight?arregloId=55555555-5555-4555-8555-555555555555");
    const payload = JSON.parse(String(fetchMock.mock.calls[1][1].body));
    expect(payload).toMatchObject({ arregloId: "55555555-5555-4555-8555-555555555555", facturaId: null });
    expect(payload.lineas).toEqual([{ facturaLineaId: null, codigo: "REP-1", descripcion: "Pastillas de freno", observaciones: null, cantidad: 3 }]);
    await waitFor(() => expect(onEmitted).toHaveBeenCalledWith(REMITO_ID));
  });
});

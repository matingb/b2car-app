import { fireEvent, screen, waitFor } from "@testing-library/react";
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
  await seleccionarTipo("X");
  fireEvent.change(screen.getByLabelText(/Apellido y nombre/), { target: { value: "Juan Pérez" } });
  if (!screen.queryByLabelText("Descripción del ítem 1")) {
    fireEvent.click(screen.getByText("Agregar ítem"));
  }
  fireEvent.change(screen.getByLabelText("Descripción del ítem 1"), { target: { value: "Neumático" } });
}

async function seleccionarTipo(clase: "R" | "X") {
  fireEvent.click(await screen.findByTestId("remito-tipo"));
  fireEvent.click(await screen.findByTestId(`remito-tipo-option-${clase}`));
}

async function emitirRemito() {
  fireEvent.click(screen.getByTestId("remito-emitir"));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId("remito-emitir")).toBeEnabled());
}

describe("RemitoForm", () => {
  it("con R no emitible muestra los motivos y bloquea la emisión sin deshabilitar ni cambiar el tipo", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(respuesta(preflight));
    renderForm();

    const selector = await screen.findByTestId("remito-tipo");
    expect(selector).toHaveTextContent("Seleccioná un tipo");
    fireEvent.click(selector);
    const opcionR = screen.getByTestId("remito-tipo-option-R");
    const opcionX = screen.getByTestId("remito-tipo-option-X");
    expect(opcionR).toHaveAttribute("aria-selected", "false");
    expect(opcionX).toHaveAttribute("aria-selected", "false");
    expect(screen.getByTestId("remito-emitir")).toBeDisabled();
    expect(screen.queryByTestId("remito-blocking-reason")).not.toBeInTheDocument();

    fireEvent.click(opcionR);
    fireEvent.change(screen.getByLabelText(/Apellido y nombre/), { target: { value: "Juan" } });
    fireEvent.click(screen.getByText("Agregar ítem"));
    fireEvent.change(screen.getByLabelText("Descripción del ítem 1"), { target: { value: "Rueda" } });

    expect(screen.getByTestId("remito-r-motivos")).toHaveTextContent("Falta configurar el CAI.");
    expect(screen.getByTestId("remito-r-motivos")).toHaveTextContent("Falta el punto de emisión.");
    expect(screen.getByRole("link", { name: "Ir a Configuración > Remitos" })).toHaveAttribute("href", "/configuracion/remitos");
    expect(selector).toHaveTextContent("Remito R");
    fireEvent.click(selector);
    expect(screen.getByTestId("remito-tipo-option-R")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("remito-tipo-option-X")).toHaveAttribute("aria-selected", "false");
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
    await emitirRemito();
    expect(await screen.findByText("El número de remito ya fue utilizado.")).toBeInTheDocument();
    expect(onEmitted).not.toHaveBeenCalled();

    await emitirRemito();
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
    expect(screen.getByRole("link", { name: "Ir a Configuración > Facturación" })).toHaveAttribute("href", "/configuracion/facturacion");
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
    await seleccionarTipo("X");
    await emitirRemito();
    const payload = JSON.parse(String(fetchMock.mock.calls[1][1].body));
    expect(payload.lineas).toEqual([{
      facturaLineaId: null, codigo: "FIL", descripcion: "Caja de repuestos entregados", observaciones: null, cantidad: 2,
    }]);
    expect(document.body.textContent).not.toMatch(/\$|precio|importe/i);
  });

  it("emite ítems libres y vinculados juntos, controlando solo la cantidad vinculada", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock
      .mockResolvedValueOnce(respuesta({
        ...preflight,
        factura: {
          id: "44444444-4444-4444-8444-444444444444",
          label: "Factura C 00001-00000123",
          fechaComprobante: "2026-10-01",
          destinatario: { clienteId: null, nombre: "Cliente Factura", domicilio: null, tipoDocumento: null, numeroDocumento: null, condicionIvaReceptorId: null },
          lineas: [{ id: "l1", ordinal: 1, origen: "REPUESTO", codigo: "FIL", descripcion: "Filtro", cantidadFacturada: 3, cantidadRemitida: 1, cantidadDisponible: 2 }],
        },
      }))
      .mockResolvedValueOnce(respuesta({ id: REMITO_ID }));
    const onEmitted = vi.fn();
    renderWithProviders(<RemitoForm facturaId="44444444-4444-4444-8444-444444444444" onEmitted={onEmitted} />);
    await seleccionarTipo("X");
    fireEvent.click(screen.getByText("Agregar ítem"));
    fireEvent.change(screen.getByLabelText("Descripción del ítem 2"), { target: { value: "Embalajes" } });
    fireEvent.change(screen.getByLabelText("Cantidad del ítem 2"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Cantidad del ítem 1"), { target: { value: "3" } });
    expect(screen.getByTestId("remito-emitir")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Cantidad del ítem 1"), { target: { value: "2" } });
    expect(screen.getByTestId("remito-emitir")).toBeEnabled();
    await emitirRemito();
    await waitFor(() => expect(onEmitted).toHaveBeenCalledWith(REMITO_ID));
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body))).toMatchObject({
      facturaId: "44444444-4444-4444-8444-444444444444",
      lineas: [
        { facturaLineaId: "l1", descripcion: "Filtro", cantidad: 2 },
        { facturaLineaId: null, descripcion: "Embalajes", cantidad: 100 },
      ],
    });
  });

  it.each([false, true])("precarga bienes desde un arreglo y conserva su factura cuando existe (%s)", async (facturado) => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock
      .mockResolvedValueOnce(respuesta({
        ...preflight,
        factura: facturado ? {
          id: "44444444-4444-4444-8444-444444444444",
          label: "Factura C 00001-00000123",
          fechaComprobante: "2026-10-01",
          destinatario: { clienteId: null, nombre: "Cliente Factura", domicilio: "Calle fiscal", tipoDocumento: null, numeroDocumento: null, condicionIvaReceptorId: null },
          lineas: [
            { id: "l1", ordinal: 1, origen: "REPUESTO", codigo: "REP-1", descripcion: "Pastillas de freno", cantidadFacturada: 3, cantidadRemitida: 1, cantidadDisponible: 2 },
            { id: "l2", ordinal: 2, origen: "SERVICIO", codigo: null, descripcion: "Mano de obra", cantidadFacturada: 1, cantidadRemitida: 0, cantidadDisponible: 1 },
          ],
        } : null,
        arreglo: {
          id: "55555555-5555-4555-8555-555555555555",
          label: "Arreglo N° 42",
          facturaId: facturado ? "44444444-4444-4444-8444-444444444444" : null,
          facturaNumero: facturado ? "00001-00000123" : null,
          destinatario: { clienteId: null, nombre: "Cliente del arreglo", domicilio: "Calle 2", tipoDocumento: null, numeroDocumento: null, condicionIvaReceptorId: null },
          lineas: [{ codigo: "REP-1", descripcion: "Pastillas de freno", cantidad: 3 }],
        },
      }))
      .mockResolvedValueOnce(respuesta({ id: REMITO_ID }));
    const onEmitted = vi.fn();
    renderWithProviders(<RemitoForm facturaId={null} arregloId="55555555-5555-4555-8555-555555555555" onEmitted={onEmitted} />);

    expect(await screen.findByLabelText(/Apellido y nombre/)).toHaveValue("Cliente del arreglo");
    expect(screen.getByLabelText("Domicilio de entrega")).toHaveValue("Calle 2");
    expect(screen.getByLabelText("Observaciones", { selector: "textarea" })).toHaveValue(facturado ? "Factura asociada: 00001-00000123" : "");
    expect(screen.queryByTestId("remito-destinatario-cliente")).not.toBeInTheDocument();
    expect(screen.queryByText(/Remito iniciado desde/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Descripción del ítem 1")).toHaveValue("Pastillas de freno");
    expect(screen.getByLabelText("Cantidad del ítem 1")).toHaveValue(facturado ? 2 : 3);
    expect(screen.queryByLabelText("Descripción del ítem 2")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Descripción del ítem 1"), { target: { value: "Pastillas entregadas" } });
    await seleccionarTipo("X");
    await emitirRemito();

    expect(fetchMock.mock.calls[0][0]).toBe("/api/remitos/preflight?arregloId=55555555-5555-4555-8555-555555555555");
    const payload = JSON.parse(String(fetchMock.mock.calls[1][1].body));
    expect(payload).toMatchObject({
      arregloId: "55555555-5555-4555-8555-555555555555",
      facturaId: facturado ? "44444444-4444-4444-8444-444444444444" : null,
    });
    expect(payload.observaciones).toBe(facturado ? "Factura asociada: 00001-00000123" : null);
    expect(payload.lineas).toEqual([{
      facturaLineaId: null,
      codigo: "REP-1", descripcion: "Pastillas entregadas", observaciones: null, cantidad: facturado ? 2 : 3,
    }]);
    await waitFor(() => expect(onEmitted).toHaveBeenCalledWith(REMITO_ID));
  });
});

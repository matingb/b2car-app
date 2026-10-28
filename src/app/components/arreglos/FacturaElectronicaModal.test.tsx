import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatCalendarDateLabel, toISODateAppTimeZone } from "@/lib/fechas";
import type { FacturaRevision } from "@/lib/facturacion/types";
import FacturaElectronicaModal from "./FacturaElectronicaModal";

const fetchMock = vi.fn();
const today = toISODateAppTimeZone(new Date());
const CUIT_A = "30712345671";
const CUIT_B = "20123456786";
const ENDPOINT = "/api/arreglos/arreglo-1/factura";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

type Call = { url: string; method: string; body: Record<string, unknown> | null };
type Handler = (call: Call) => Response | Promise<Response>;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

const preflight = {
  puedeEmitir: true,
  configuracionCompleta: true,
  origenListo: true,
  diferenciasTotal: false,
  preciosIncluyenIva: true,
  emisor: { razonSocial: "Taller prueba", cuit: "20442094161", puntoVenta: 1, ambiente: "HOMOLOGACION", condicionIvaEmisor: "MONOTRIBUTISTA" },
  receptor: { clienteId: "cliente-1", nombre: "Cliente prueba", domicilio: "Calle 1", tipoDocumento: 86, numeroDocumento: CUIT_B, condicionIvaReceptorId: 5 },
  clienteAsociado: { clienteId: "cliente-1", nombre: "Cliente prueba", documento: "12345678" },
  concepto: 2,
  documentoTipo: "FACTURA",
  claseComprobante: "C",
  tipoComprobante: 11,
  lineas: [{ ordinal: 1, origen: "SERVICIO", descripcion: "Servicio", cantidad: 1, importeUnitario: 100, subtotal: 100 }],
  totales: { netoGravado: 100, noGravado: 0, exento: 0, iva: 0, tributos: 0, otrosImpuestosNacionales: 0, total: 100 },
  total: 100,
  precioFinal: 100,
  fechasDefault: { fechaComprobante: today, fechaServicioDesde: today, fechaServicioHasta: today, fechaVencimientoPago: today },
  fcePosible: false,
  fceObligatoria: false,
  fceSistemaConfigurado: "ADC",
  fceCbuConfigurado: true,
  fceFechaConsulta: today,
  fceTotalConsultado: 100,
};

function revision(overrides: Partial<FacturaRevision> = {}): FacturaRevision {
  return {
    revisionHash: "a".repeat(64),
    origenTipo: "ARREGLO",
    origenId: "arreglo-1",
    ambiente: "HOMOLOGACION",
    clienteAsociado: preflight.clienteAsociado,
    receptorModo: "CLIENTE",
    emisor: { razonSocial: "Taller prueba", nombreFantasia: null, cuit: "20442094161", domicilio: "Calle 9", condicionIva: "Monotributista", ingresosBrutos: "Exento", inicioActividades: "2020-01-01", puntoVenta: 1 },
    receptor: { clienteId: "cliente-1", nombre: "Cliente prueba", domicilio: "Calle 1", tipoDocumento: 86, numeroDocumento: CUIT_B, condicionIvaReceptorId: 5, identidadRevisada: true },
    documentoTipo: "FACTURA",
    claseComprobante: "C",
    tipoComprobante: 11,
    concepto: 2,
    fce: null,
    condicionVenta: "CONTADO",
    fechas: { fechaComprobante: today, fechaServicioDesde: today, fechaServicioHasta: today, fechaVencimientoPago: today },
    moneda: "PES",
    detalleSimplificado: true,
    lineas: [{ ordinal: 1, origen: "SERVICIO", descripcion: "Service completo", codigo: null, cantidad: 1, importeUnitario: 100, subtotal: 100, importeMostrado: 100 }],
    cantidadLineasOriginales: 1,
    preciosIncluyenIva: true,
    totales: preflight.totales,
    issues: [],
    ...overrides,
  };
}

const authorized = {
  id: "factura-1", estado: "AUTORIZADA", ambiente: "HOMOLOGACION", origenTipo: "ARREGLO", origenId: "arreglo-1",
  documentoTipo: "FACTURA", claseComprobante: "C", tipoComprobante: 11, puntoVenta: 1, numeroComprobante: 1,
  cae: "12345678901234", caeVencimiento: "2026-09-23", total: 100, concepto: 2, fechaComprobante: today,
  receptorNombre: "Cliente prueba", receptorDocumento: CUIT_B,
};

const persons: Record<string, { cuit: string; nombre: string; direccion: string | null }> = {
  [CUIT_A]: { cuit: CUIT_A, nombre: "Empresa A SA", direccion: "Av. A 100" },
  [CUIT_B]: { cuit: CUIT_B, nombre: "Empresa B SRL", direccion: null },
};

let handlers: Record<string, Handler>;
const calls = (key: string) => fetchMock.mock.calls
  .map(([input, init]) => ({ url: String(input), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null }))
  .filter(({ url, method }) => `${method} ${url.split("?")[0]}` === key);

beforeEach(() => {
  handlers = {
    [`GET ${ENDPOINT}`]: () => json({
      data: { factura: null, preflight: { ...preflight, receptor: { ...preflight.receptor, tipoDocumento: 99 }, receptorPendiente: true } },
      error: null,
    }),
    "GET /api/facturacion/receptor": () => json({ data: { receptor: preflight.receptor, clienteAsociado: preflight.clienteAsociado }, error: null }),
    "GET /api/fiscal/persona": ({ url }) => {
      const number = new URL(url, "http://localhost").searchParams.get("numeroDocumento") ?? "";
      const person = persons[number];
      if (!person) return json({ error: "No se encontraron datos en ARCA" }, 404);
      return json({ data: { status: "FOUND", person: { ...person, tipoPersona: "JURIDICA", estadoClave: "ACTIVO", apellido: null, razonSocial: person.nombre, nombreCompleto: person.nombre } } });
    },
    "GET /api/fiscal/condicion-iva": ({ url }) => {
      const cuit = new URL(url, "http://localhost").searchParams.get("cuit") ?? "";
      const condicion = cuit === CUIT_A ? { id: 1, label: "Responsable inscripto" } : { id: 5, label: "Consumidor final" };
      return json({ data: { status: "FOUND", condition: { cuit, condicionIvaReceptorId: condicion.id, condicionIvaLabel: condicion.label } } });
    },
    "POST /api/facturacion/previsualizacion": () => json({ data: revision(), error: null, issues: [] }),
    "POST /api/facturacion/previsualizacion/pdf": () => new Response(new Blob(["%PDF-borrador"], { type: "application/pdf" }), { status: 200 }),
    [`POST ${ENDPOINT}`]: () => json({ data: authorized, error: null }),
  };
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const handler = handlers[`${method} ${url.split("?")[0]}`];
    if (!handler) return json({ error: "Ruta no esperada" }, 404);
    return handler({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
  });
  vi.stubGlobal("fetch", fetchMock);
  URL.createObjectURL = vi.fn(() => "blob:borrador");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function Harness({ onAuthorized = vi.fn(), onClose = vi.fn() }: { onAuthorized?: () => void; onClose?: () => void }) {
  const [open, setOpen] = useState(true);
  return <FacturaElectronicaModal
    open={open}
    arregloId="arreglo-1"
    onClose={() => { onClose(); setOpen(false); }}
    onAuthorized={onAuthorized}
  />;
}

async function renderLoaded(props: Parameters<typeof Harness>[0] = {}) {
  render(<Harness {...props} />);
  await waitFor(() => expect(screen.getByTestId("factura-receptor-nombre")).toHaveValue("Cliente prueba"));
}

describe("FacturaElectronicaModal", () => {
  it.each(["Ahora no", "Descargar PDF"])("revisa, permite volver sin perder datos y emite una sola vez al confirmar (%s)", async (accion) => {
    const onAuthorized = vi.fn();
    const onClose = vi.fn();
    const downloadClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await renderLoaded({ onAuthorized, onClose });

    // El cliente del arreglo se identifica en la misma opción para facturarle.
    expect(screen.getByTestId("factura-cliente-asociado")).toHaveTextContent("Cliente prueba · Doc. 12345678");
    expect(screen.getByTestId("factura-receptor-modo-cliente")).toBeChecked();
    expect(calls(`GET ${ENDPOINT}`)[0].url).toBe(`${ENDPOINT}?receptor=diferido`);
    expect(calls("GET /api/facturacion/receptor")[0].url).toBe("/api/facturacion/receptor?origenTipo=ARREGLO&origenId=arreglo-1");
    expect(within(screen.getByTestId("factura-fechas-periodo")).getAllByText(formatCalendarDateLabel(today))).toHaveLength(3);
    // Al facturarle al cliente del arreglo se usan siempre sus datos.
    expect(screen.getByTestId("factura-numero-documento")).toBeDisabled();
    expect(screen.getByTestId("factura-receptor-nombre")).toBeDisabled();
    expect(screen.getByTestId("factura-receptor-domicilio")).toBeDisabled();
    expect(screen.getByTestId("factura-tipo-documento")).toBeDisabled();
    expect(screen.getByTestId("factura-condicion-iva")).toBeDisabled();
    expect(screen.queryByTestId("factura-facturar-otro-cuit")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cerrar" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Simplificar el detalle de la factura"));
    expect(screen.getByTestId("factura-detalle-descripcion")).toHaveValue("Servicio de reparación y mantenimiento automotor");
    fireEvent.change(screen.getByTestId("factura-detalle-descripcion"), { target: { value: "Service completo" } });

    fireEvent.click(screen.getByTestId("modal-submit"));

    await waitFor(() => expect(screen.getByText("Revisar factura antes de emitir")).toBeInTheDocument());
    expect(screen.getByText(/Paso 2 de 2/)).toBeInTheDocument();
    expect(calls(`POST ${ENDPOINT}`)).toHaveLength(0);
    expect(calls("POST /api/facturacion/previsualizacion")[0].body).toMatchObject({
      origenTipo: "ARREGLO", origenId: "arreglo-1", detalleSimplificado: true, descripcionDetalleSimplificado: "Service completo",
      receptor: { modo: "CLIENTE", nombre: "Cliente prueba", domicilio: "Calle 1", tipoDocumento: 86, numeroDocumento: CUIT_B, condicionIvaReceptorId: 5 },
    });
    // La confirmación muestra sólo el PDF borrador, sin el resumen lateral.
    expect(screen.queryByTestId("factura-revision-resumen")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("pdf-document-viewer-open")).toHaveAttribute("href", "blob:borrador"));
    expect(screen.getByTitle("Vista previa del comprobante (borrador sin validez fiscal)")).toHaveAttribute("data", "blob:borrador");
    expect(calls("POST /api/facturacion/previsualizacion/pdf")[0].body).toMatchObject({ revisionHash: "a".repeat(64) });

    fireEvent.click(screen.getByTestId("factura-volver-editar"));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:borrador");
    expect(screen.getByTestId("factura-detalle-descripcion")).toHaveValue("Service completo");
    expect(screen.getByTestId("factura-receptor-nombre")).toHaveValue("Cliente prueba");

    fireEvent.click(screen.getByTestId("modal-submit"));
    await waitFor(() => expect(screen.getByTestId("factura-confirmar-emitir")).toBeEnabled());
    fireEvent.click(screen.getByTestId("factura-confirmar-emitir"));
    fireEvent.click(screen.getByTestId("factura-confirmar-emitir"));

    await waitFor(() => expect(onAuthorized).toHaveBeenCalledWith(expect.objectContaining({ id: "factura-1" })));
    expect(onAuthorized).toHaveBeenCalledTimes(1);
    expect(calls(`POST ${ENDPOINT}`)).toHaveLength(1);
    expect(calls(`POST ${ENDPOINT}`)[0].body).toMatchObject({
      revisionHash: "a".repeat(64), detalleSimplificado: true, descripcionDetalleSimplificado: "Service completo",
      fcePreflightConfirmada: false, receptor: { modo: "CLIENTE", nombre: "Cliente prueba" },
    });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByText("Factura creada")).toBeInTheDocument();
    expect(screen.getByText("Factura C 00001-00000001")).toBeInTheDocument();
    expect(downloadClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: accion }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    if (accion === "Descargar PDF") {
      expect(downloadClick).toHaveBeenCalledOnce();
      expect(downloadClick.mock.instances[0]).toHaveAttribute("href", "/api/facturas/factura-1/pdf");
    } else {
      expect(downloadClick).not.toHaveBeenCalled();
    }
  });

  it("factura a otro CUIT con los datos de ARCA y descarta la identidad anterior al cambiar el CUIT", async () => {
    await renderLoaded();

    fireEvent.click(screen.getByTestId("factura-receptor-modo-otro"));
    expect(screen.getByTestId("factura-otro-receptor-aviso")).toHaveTextContent("El cliente del arreglo no cambiará");
    expect(screen.getByTestId("factura-receptor-nombre")).toHaveValue("");
    expect(screen.getByTestId("factura-receptor-domicilio")).toHaveValue("");
    expect(screen.getByTestId("factura-receptor-nombre")).toBeEnabled();
    expect(screen.getByTestId("factura-numero-documento")).toBeEnabled();

    fireEvent.change(screen.getByTestId("factura-numero-documento"), { target: { value: CUIT_A } });
    await waitFor(() => expect(screen.getByTestId("factura-receptor-nombre")).toHaveValue("Empresa A SA"));
    expect(screen.getByTestId("factura-receptor-domicilio")).toHaveValue("Av. A 100");
    await waitFor(() => expect(screen.getByTestId("factura-condicion-iva")).toHaveTextContent("Responsable inscripto"));

    fireEvent.change(screen.getByTestId("factura-numero-documento"), { target: { value: CUIT_B } });
    expect(screen.getByTestId("factura-receptor-nombre")).toHaveValue("");
    expect(screen.getByTestId("factura-receptor-domicilio")).toHaveValue("");
    await waitFor(() => expect(screen.getByTestId("factura-receptor-nombre")).toHaveValue("Empresa B SRL"));
    expect(screen.getByTestId("factura-receptor-domicilio")).toHaveValue("");
    expect(screen.getByText("ARCA no informa domicilio para este documento. Podés completarlo.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("factura-condicion-iva")).toHaveTextContent("Consumidor final"));

    fireEvent.click(screen.getByTestId("modal-submit"));
    await waitFor(() => expect(calls("POST /api/facturacion/previsualizacion")).toHaveLength(1));
    expect(calls("POST /api/facturacion/previsualizacion")[0].body).toMatchObject({
      receptor: { modo: "OTRO", nombre: "Empresa B SRL", domicilio: null, tipoDocumento: 80, numeroDocumento: CUIT_B, condicionIvaReceptorId: 5 },
    });

    fireEvent.click(await screen.findByTestId("factura-volver-editar"));
    fireEvent.click(screen.getByTestId("factura-receptor-modo-cliente"));
    expect(screen.getByTestId("factura-receptor-nombre")).toHaveValue("Cliente prueba");
    expect(screen.getByTestId("factura-numero-documento")).toHaveValue(CUIT_B);
    expect(screen.getByTestId("factura-receptor-nombre")).toBeDisabled();
  });

  it("muestra el formulario completo mientras sólo los datos del cliente se cargan", async () => {
    let resolveReceptor: (response: Response) => void = () => {};
    handlers["GET /api/facturacion/receptor"] = () => new Promise<Response>((resolve) => { resolveReceptor = resolve; });
    render(<Harness />);

    await waitFor(() => expect(screen.getByTestId("factura-receptor-datos")).toHaveAttribute("aria-busy", "true"));
    expect(screen.getByText("Buscando los datos fiscales del cliente del arreglo en ARCA…")).toBeInTheDocument();
    expect(screen.getByTestId("factura-receptor-nombre")).toHaveAttribute("placeholder", "Cargando…");
    expect(screen.getByTestId("factura-receptor-nombre")).toHaveValue("");
    expect(screen.getByTestId("modal-submit")).toBeDisabled();
    expect(screen.getByTestId("modal-submit")).toHaveTextContent("Cargando datos del cliente…");
    // El resto del formulario ya se puede usar.
    expect(screen.getByTestId("factura-condicion-venta")).toBeEnabled();
    expect(screen.getByTestId("factura-fecha-comprobante")).toBeEnabled();
    fireEvent.click(screen.getByLabelText("Simplificar el detalle de la factura"));
    expect(screen.getByTestId("factura-detalle-descripcion")).toBeEnabled();

    // Elegir otro receptor no espera al cliente y no se pisa cuando sus datos llegan.
    fireEvent.click(screen.getByTestId("factura-receptor-modo-otro"));
    fireEvent.change(screen.getByTestId("factura-receptor-nombre"), { target: { value: "Otra Empresa" } });
    resolveReceptor(json({ data: { receptor: preflight.receptor, clienteAsociado: preflight.clienteAsociado }, error: null }));
    await waitFor(() => expect(screen.getByTestId("factura-receptor-datos")).toHaveAttribute("aria-busy", "false"));
    expect(screen.getByTestId("factura-receptor-nombre")).toHaveValue("Otra Empresa");

    fireEvent.click(screen.getByTestId("factura-receptor-modo-cliente"));
    expect(screen.getByTestId("factura-receptor-nombre")).toHaveValue("Cliente prueba");
    expect(screen.getByTestId("modal-submit")).toHaveTextContent("Revisar factura");
  });

  it("permite reintentar si no se pudieron obtener los datos del cliente", async () => {
    let attempts = 0;
    handlers["GET /api/facturacion/receptor"] = () => {
      attempts += 1;
      return attempts === 1
        ? json({ error: "No se pudo obtener información desde ARCA." }, 503)
        : json({ data: { receptor: preflight.receptor, clienteAsociado: preflight.clienteAsociado }, error: null });
    };
    render(<Harness />);

    await waitFor(() => expect(screen.getByText(/No se pudo obtener información desde ARCA\. Podés reintentar/)).toBeInTheDocument());
    expect(screen.getByTestId("modal-submit")).toHaveTextContent("Datos del cliente no disponibles");
    fireEvent.click(within(screen.getByTestId("factura-receptor-estado")).getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(screen.getByTestId("factura-receptor-nombre")).toHaveValue("Cliente prueba"));
    expect(screen.getByTestId("modal-submit")).toBeEnabled();
  });

  it("permite elegir la condición IVA del cliente sólo cuando ARCA no pudo confirmarla", async () => {
    handlers["GET /api/facturacion/receptor"] = () => json({
      data: { receptor: { ...preflight.receptor, condicionIvaReceptorId: null }, clienteAsociado: preflight.clienteAsociado },
      error: null,
    });
    handlers["GET /api/fiscal/condicion-iva"] = () => json({ error: "No se pudo verificar la condición IVA en ARCA" }, 503);
    await renderLoaded();

    expect(screen.getByTestId("factura-receptor-nombre")).toBeDisabled();
    expect(screen.getByTestId("factura-numero-documento")).toBeDisabled();
    expect(screen.getByTestId("factura-condicion-iva")).toBeEnabled();
  });

  it("agrupa los errores del formulario sin pedir la revisión y lleva el foco al campo", async () => {
    await renderLoaded();
    expect(screen.queryByTestId("factura-issues")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("factura-receptor-modo-otro"));
    fireEvent.click(screen.getByTestId("factura-fecha-comprobante-clear"));
    fireEvent.click(screen.getByTestId("modal-submit"));

    const summary = await screen.findByTestId("factura-issues");
    expect(summary).toHaveTextContent("Revisá estos datos (4)");
    expect(within(summary).getByText("Receptor")).toBeInTheDocument();
    expect(within(summary).getByText("Comprobante y fechas")).toBeInTheDocument();
    expect(document.activeElement).toBe(summary);
    expect(screen.getByTestId("factura-receptor-nombre")).toHaveAttribute("aria-invalid", "true");
    expect(calls("POST /api/facturacion/previsualizacion")).toHaveLength(0);

    fireEvent.click(within(summary).getByText("Ingresá el nombre o la razón social del receptor."));
    expect(document.activeElement).toBe(screen.getByTestId("factura-receptor-nombre"));
  });

  it("muestra los errores agrupados que devuelve la revisión y Enter nunca emite", async () => {
    handlers["POST /api/facturacion/previsualizacion"] = () => json({
      data: null,
      error: "La fecha debe estar dentro de los 10 días de hoy",
      issues: [{ codigo: "FECHAS_INVALIDAS", grupo: "COMPROBANTE", campo: "fechas.fechaComprobante", mensaje: "La fecha debe estar dentro de los 10 días de hoy", severidad: "error" }],
    }, 422);
    await renderLoaded();

    fireEvent.submit(screen.getByTestId("factura-receptor-nombre").closest("form")!);

    await waitFor(() => expect(screen.getByTestId("factura-issues")).toHaveTextContent("La fecha debe estar dentro de los 10 días de hoy"));
    expect(screen.getByText("Facturación electrónica")).toBeInTheDocument();
    expect(calls(`POST ${ENDPOINT}`)).toHaveLength(0);
  });

  it("vuelve a revisar con la misma clave si el contenido o la obligación FCE cambiaron", async () => {
    const onAuthorized = vi.fn();
    let emissions = 0;
    handlers[`POST ${ENDPOINT}`] = () => {
      emissions += 1;
      return emissions === 1
        ? json({ code: "FCE_DATA_REQUIRED", error: "ARCA determinó que corresponde una FCE", fce: { cbuConfigurado: true, sistema: "ADC" } }, 422)
        : json({ data: { ...authorized, tipoComprobante: 211 }, error: null });
    };
    await renderLoaded({ onAuthorized });
    fireEvent.click(screen.getByTestId("modal-submit"));
    await waitFor(() => expect(screen.getByTestId("factura-confirmar-emitir")).toBeEnabled());
    handlers["POST /api/facturacion/previsualizacion"] = () => json({ data: revision({ revisionHash: "b".repeat(64), tipoComprobante: 211, fce: { sistema: "ADC", cbu: "1234567890123456789012" } }), error: null, issues: [] });

    fireEvent.click(screen.getByTestId("factura-confirmar-emitir"));

    await waitFor(() => expect(screen.getByText(/Los datos cambiaron desde la revisión anterior/)).toBeInTheDocument());
    // El borrador se regenera para la revisión nueva (ahora FCE).
    await waitFor(() => expect(calls("POST /api/facturacion/previsualizacion/pdf").at(-1)?.body).toMatchObject({ revisionHash: "b".repeat(64) }));
    expect(onAuthorized).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId("factura-confirmar-emitir")).toBeEnabled());

    fireEvent.click(screen.getByTestId("factura-confirmar-emitir"));

    await waitFor(() => expect(onAuthorized).toHaveBeenCalledTimes(1));
    const [first, second] = calls(`POST ${ENDPOINT}`);
    expect(second.body).toMatchObject({ revisionHash: "b".repeat(64), fcePreflightConfirmada: true, idempotencyKey: first.body!.idempotencyKey });
    expect(screen.getByText("Factura de Crédito Electrónica MiPyME 00001-00000001")).toBeInTheDocument();
  });
});

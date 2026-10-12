import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import FacturaElectronicaModal from "./FacturaElectronicaModal";

const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("FacturaElectronicaModal", () => {
  it.each(["Ahora no", "Descargar PDF"])("mantiene el documento, reemplaza el formulario por la confirmación y permite %s", async (accion) => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          factura: null,
          preflight: {
          puedeEmitir: true,
          configuracionCompleta: true,
          origenListo: true,
          diferenciasTotal: false,
          emisor: {
            razonSocial: "Taller prueba",
            cuit: "20123456786",
            puntoVenta: 1,
            ambiente: "HOMOLOGACION",
            condicionIvaEmisor: "MONOTRIBUTISTA",
          },
          receptor: {
            clienteId: "cliente-1",
            nombre: "Cliente prueba",
            domicilio: null,
            tipoDocumento: 96,
            numeroDocumento: "12345678",
            condicionIvaReceptorId: null,
          },
          advertenciaArcaReceptor: "No se pudo obtener información desde ARCA para este documento.",
          concepto: 1,
          documentoTipo: "FACTURA",
          claseComprobante: "C",
          tipoComprobante: 11,
          lineas: [{
            ordinal: 1,
            origen: "SERVICIO",
            descripcion: "Servicio",
            cantidad: 1,
            importeUnitario: 100,
            subtotal: 100,
          }],
          totales: {
            netoGravado: 100,
            noGravado: 0,
            exento: 0,
            iva: 0,
            tributos: 0,
            otrosImpuestosNacionales: 0,
            total: 100,
          },
          total: 100,
          precioFinal: 100,
          fechasDefault: { fechaComprobante: "2026-09-13" },
          },
        },
        error: null,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { preflight: { fcePosible: false, fceObligatoria: false, fceFechaConsulta: "2026-09-13", fceTotalConsultado: 100 } }, error: null }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        code: "FCE_DATA_REQUIRED",
        error: "ARCA determinó que corresponde una FCE",
        fce: { cbuConfigurado: true, sistema: "ADC" },
      }), { status: 422 }));

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      data: {
        id: "factura-1",
        estado: "AUTORIZADA",
        ambiente: "HOMOLOGACION",
        origenTipo: "ARREGLO",
        origenId: "arreglo-1",
        documentoTipo: "FACTURA",
        claseComprobante: "C",
        tipoComprobante: 211,
        puntoVenta: 1,
        numeroComprobante: 1,
        cae: "12345678901234",
        caeVencimiento: "2026-09-23",
        total: 100,
        concepto: 1,
        fechaComprobante: "2026-09-13",
        receptorNombre: "Cliente prueba",
        receptorDocumento: "12345678",
      },
      error: null,
    }), { status: 200 }));

    const onAuthorized = vi.fn();
    const onClose = vi.fn();
    const downloadClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    function Harness() {
      const [open, setOpen] = useState(true);
      return <FacturaElectronicaModal
        open={open}
        arregloId="arreglo-1"
        onClose={() => { onClose(); setOpen(false); }}
        onAuthorized={onAuthorized}
      />;
    }

    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByTestId("factura-numero-documento")).toHaveValue("12345678");
    });
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("tipoDocumento=96"))).toBe(true));
    expect(String(fetchMock.mock.calls.find(([url]) => String(url).includes("tipoDocumento=96"))?.[0])).not.toContain("numeroDocumento=20123456786");

    expect(screen.getByText("No se pudo obtener información desde ARCA para este documento.")).toBeInTheDocument();
    expect(screen.queryByTestId("modal-error")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("modal-submit")).toBeEnabled());

    fireEvent.click(screen.getByLabelText("Simplificar el detalle de la factura"));

    expect(screen.getByText(/Servicio de reparación y mantenimiento automotor/)).toBeInTheDocument();
    expect(screen.queryByText(/^Servicio$/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("modal-submit"));
    await waitFor(() => expect(screen.getByText(/ARCA confirmó que esta operación requiere FCE/)).toBeInTheDocument());
    expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))).toMatchObject({ fcePreflightConfirmada: false });
    const originalIntentKey = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body)).idempotencyKey;
    fireEvent.click(screen.getByTestId("modal-submit"));

    await waitFor(() => {
      expect(onAuthorized).toHaveBeenCalledWith(expect.objectContaining({ id: "factura-1" }));
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/arreglos/arreglo-1/factura",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))).toMatchObject({
      detalleSimplificado: true,
      fcePreflightConfirmada: true,
      idempotencyKey: originalIntentKey,
    });
    expect(onAuthorized).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("factura-numero-documento")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Facturación electrónica" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByText("Factura creada")).toBeInTheDocument();
    expect(screen.getByText("La factura se creó satisfactoriamente.")).toBeInTheDocument();
    expect(screen.getByText("Factura de Crédito Electrónica MiPyME 00001-00000001")).toBeInTheDocument();
    expect(screen.getByText("¿Querés descargar el PDF de la factura?")).toBeInTheDocument();
    expect(downloadClick).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: accion }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    if (accion === "Descargar PDF") {
      expect(downloadClick).toHaveBeenCalledOnce();
      expect(downloadClick.mock.instances[0]).toHaveAttribute("href", "/api/facturas/factura-1/pdf");
      expect(downloadClick.mock.instances[0]).toHaveAttribute("download", "");
    } else {
      expect(downloadClick).not.toHaveBeenCalled();
    }
  });
});

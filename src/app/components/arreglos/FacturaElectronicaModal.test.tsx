import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  it("mantiene el documento y permite emitir cuando ARCA no pudo verificarlo", async () => {
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
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          id: "factura-1",
          estado: "AUTORIZADA",
          ambiente: "HOMOLOGACION",
          origenTipo: "ARREGLO",
          origenId: "arreglo-1",
          documentoTipo: "FACTURA",
          claseComprobante: "C",
          tipoComprobante: 11,
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

    render(
      <FacturaElectronicaModal
        open
        arregloId="arreglo-1"
        onClose={vi.fn()}
        onAuthorized={onAuthorized}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("factura-numero-documento")).toHaveValue("12345678");
    });

    expect(screen.getByText("No se pudo obtener información desde ARCA para este documento.")).toBeInTheDocument();
    expect(screen.queryByTestId("modal-error")).not.toBeInTheDocument();
    expect(screen.getByTestId("modal-submit")).toBeEnabled();

    fireEvent.click(screen.getByTestId("modal-submit"));

    await waitFor(() => {
      expect(onAuthorized).toHaveBeenCalledWith(expect.objectContaining({ id: "factura-1" }));
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/arreglos/arreglo-1/factura",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

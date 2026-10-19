import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ArregloPrintableInvoiceModal from "./ArregloPrintableInvoiceModal";
import {
  createArreglo,
  createArregloDetalleData,
  createCliente,
  createVehiculo,
} from "@/tests/factories";

const mocks = vi.hoisted(() => ({
  getClienteForVehiculo: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  html2canvas: vi.fn(),
  pdfSave: vi.fn(),
  pdfAddImage: vi.fn(),
  pdfAddPage: vi.fn(),
}));

vi.mock("@/clients/vehiculoClient", () => ({
  vehiculoClient: {
    getClienteForVehiculo: (...args: unknown[]) => mocks.getClienteForVehiculo(...args),
  },
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: mocks.toastSuccess,
    error: mocks.toastError,
  }),
}));

vi.mock("html2canvas-pro", () => ({
  default: (...args: unknown[]) => mocks.html2canvas(...args),
}));

vi.mock("jspdf", () => {
  const MockJsPDF = vi.fn().mockImplementation(function () {
    return {
      internal: {
        pageSize: {
          getWidth: () => 210,
          getHeight: () => 297,
        },
      },
      addImage: mocks.pdfAddImage,
      addPage: mocks.pdfAddPage,
      save: mocks.pdfSave,
    };
  });
  return {
    jsPDF: MockJsPDF,
    default: MockJsPDF,
  };
});

describe("ArregloPrintableInvoiceModal", () => {
  const sampleData = createArregloDetalleData({
    arreglo: createArreglo({
      id: "a1-12345678",
      kilometraje_leido: 75000,
      observaciones: "Nota de prueba para observaciones",
      precio_final: 50000,
      vehiculo: createVehiculo({ id: "v1", patente: "ABC123" }),
    }),
    detalles: [
      {
        id: "d1",
        arreglo_id: "a1-12345678",
        descripcion: "Mano de obra frenos",
        cantidad: 1,
        precio_hora_facturada: 25000,
        horas_facturadas: 2,
        horas_trabajadas: 2,
        categoria_arreglo_id: null,
        empleado_id: null,
      },
    ],
    asignaciones: [],
    detalle_formulario: null,
  });

  const sampleCliente = createCliente({ id: "c1", nombre: "Juan Pérez" });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.html2canvas.mockResolvedValue({
      toDataURL: () => "data:image/jpeg;base64,mock",
      width: 800,
      height: 1100,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("no renderiza contenido cuando open es false", () => {
    render(
      <ArregloPrintableInvoiceModal
        open={false}
        onClose={vi.fn()}
        data={sampleData}
      />
    );

    expect(screen.queryByText("Comprobante de orden de trabajo")).toBeNull();
  });

  it("renderiza el modal con título, número de orden y controles cuando open es true", () => {
    render(
      <ArregloPrintableInvoiceModal
        open={true}
        onClose={vi.fn()}
        data={sampleData}
        cliente={sampleCliente}
      />
    );

    expect(screen.getByText("Comprobante de orden de trabajo")).toBeDefined();
    expect(screen.getByText("N° 12345678")).toBeDefined();
    expect(screen.getByTestId("toggle-show-prices")).toBeDefined();
    expect(screen.getByTestId("toggle-show-observations")).toBeDefined();
    expect(screen.getByTestId("btn-download-pdf")).toBeDefined();
    expect(screen.getByTestId("btn-print-invoice")).toBeDefined();
  });

  it("prioriza numero_orden cuando está disponible en el arreglo", () => {
    const dataConNumeroOrden = {
      ...sampleData,
      arreglo: {
        ...sampleData.arreglo,
        numero_orden: 42,
      },
    };

    render(
      <ArregloPrintableInvoiceModal
        open={true}
        onClose={vi.fn()}
        data={dataConNumeroOrden}
        cliente={sampleCliente}
      />
    );

    expect(screen.getByText("N° 00000042")).toBeDefined();
  });

  it("muestra la vista previa en el iframe con precios y observaciones activos por defecto", () => {
    render(
      <ArregloPrintableInvoiceModal
        open={true}
        onClose={vi.fn()}
        data={sampleData}
        cliente={sampleCliente}
      />
    );

    const iframe = screen.getByTitle("Vista previa de comprobante") as HTMLIFrameElement;
    expect(iframe).toBeDefined();
    const srcDoc = iframe.getAttribute("srcdoc") || "";
    expect(srcDoc).toContain("Mano de obra frenos");
    expect(srcDoc).toContain("Nota de prueba para observaciones");
    expect(srcDoc).toContain("Total Gral.");
  });

  it("permite ocultar los precios al hacer clic en el toggle", () => {
    render(
      <ArregloPrintableInvoiceModal
        open={true}
        onClose={vi.fn()}
        data={sampleData}
        cliente={sampleCliente}
      />
    );

    const togglePrices = screen.getByTestId("toggle-show-prices");
    fireEvent.click(togglePrices);

    const iframe = screen.getByTitle("Vista previa de comprobante") as HTMLIFrameElement;
    const srcDoc = iframe.getAttribute("srcdoc") || "";
    expect(srcDoc).not.toContain('<div class="bottom-totals">');
    expect(srcDoc).toContain("Mano de obra frenos");
  });

  it("permite ocultar las observaciones al hacer clic en el toggle", () => {
    render(
      <ArregloPrintableInvoiceModal
        open={true}
        onClose={vi.fn()}
        data={sampleData}
        cliente={sampleCliente}
      />
    );

    const toggleObs = screen.getByTestId("toggle-show-observations");
    fireEvent.click(toggleObs);

    const iframe = screen.getByTitle("Vista previa de comprobante") as HTMLIFrameElement;
    const srcDoc = iframe.getAttribute("srcdoc") || "";
    expect(srcDoc).not.toContain('class="observations-label"');
    expect(srcDoc).not.toContain("Nota de prueba para observaciones");
  });

  it("ejecuta print() en el iframe al hacer clic en Imprimir", () => {
    render(
      <ArregloPrintableInvoiceModal
        open={true}
        onClose={vi.fn()}
        data={sampleData}
        cliente={sampleCliente}
      />
    );

    const iframe = screen.getByTitle("Vista previa de comprobante") as HTMLIFrameElement;
    const mockPrint = vi.fn();
    const mockFocus = vi.fn();

    Object.defineProperty(iframe, "contentWindow", {
      value: { print: mockPrint, focus: mockFocus },
      writable: true,
    });

    const printBtn = screen.getByTestId("btn-print-invoice");
    fireEvent.click(printBtn);

    expect(mockFocus).toHaveBeenCalled();
    expect(mockPrint).toHaveBeenCalled();
  });

  it("ejecuta html2canvas-pro y jspdf al presionar Descargar PDF", async () => {
    render(
      <ArregloPrintableInvoiceModal
        open={true}
        onClose={vi.fn()}
        data={sampleData}
        cliente={sampleCliente}
      />
    );

    const downloadBtn = screen.getByTestId("btn-download-pdf");
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(mocks.html2canvas).toHaveBeenCalled();
      expect(mocks.pdfSave).toHaveBeenCalledWith("orden-de-trabajo-12345678.pdf");
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "Descarga completada",
        expect.stringContaining("orden-de-trabajo-12345678.pdf")
      );
    });
  });

  it("genera múltiples páginas en PDF si el contenido excede una página A4", async () => {
    // Canvas alto que supera el alto A4
    mocks.html2canvas.mockResolvedValue({
      toDataURL: () => "data:image/jpeg;base64,mock",
      width: 800,
      height: 2500,
    });

    render(
      <ArregloPrintableInvoiceModal
        open={true}
        onClose={vi.fn()}
        data={sampleData}
        cliente={sampleCliente}
      />
    );

    const downloadBtn = screen.getByTestId("btn-download-pdf");
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(mocks.pdfAddPage).toHaveBeenCalled();
      expect(mocks.pdfSave).toHaveBeenCalled();
    });
  });

  it("llama a onClose al hacer clic en el botón de cerrar", () => {
    const handleClose = vi.fn();
    render(
      <ArregloPrintableInvoiceModal
        open={true}
        onClose={handleClose}
        data={sampleData}
        cliente={sampleCliente}
      />
    );

    const closeBtn = screen.getByLabelText("Cerrar");
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("no muestra el toggle de observaciones si el arreglo no tiene observaciones", () => {
    const dataWithoutObs = {
      ...sampleData,
      arreglo: {
        ...sampleData.arreglo,
        observaciones: "",
      },
    };

    render(
      <ArregloPrintableInvoiceModal
        open={true}
        onClose={vi.fn()}
        data={dataWithoutObs}
        cliente={sampleCliente}
      />
    );

    expect(screen.queryByTestId("toggle-show-observations")).toBeNull();
    expect(screen.getByTestId("toggle-show-prices")).toBeDefined();
  });
});

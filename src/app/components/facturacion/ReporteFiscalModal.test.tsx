import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReporteFiscalModal from "./ReporteFiscalModal";

vi.mock("@/app/components/ui/Calendar", () => ({
  default: ({
    value,
    onChange,
    dataTestId,
    disabled,
  }: {
    value: string;
    onChange: (val: string) => void;
    dataTestId?: string;
    disabled?: boolean;
  }) => (
    <input
      data-testid={dataTestId}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const onCloseMock = vi.fn();
const fetchMock = vi.fn();

beforeEach(() => {
  onCloseMock.mockClear();
  fetchMock.mockReset().mockResolvedValue(new Response("archivo", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-01T01:30:00Z")); // Mes sugerido: 2026-10 en GMT-3
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * Activa los mocks del DOM necesarios únicamente para simular la descarga de un Blob.
 */
function mockBlobDownload() {
  URL.createObjectURL = vi.fn(() => "blob:fiscal");
  URL.revokeObjectURL = vi.fn();
  let downloaded: { filename: string } | null = null;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    downloaded = { filename: this.download };
  });
  return () => downloaded;
}

function selectDropdown(testId: string, value: string) {
  fireEvent.click(screen.getByTestId(testId));
  fireEvent.click(screen.getByTestId(`${testId}-option-${value}`));
}

function submitForm() {
  fireEvent.click(screen.getByTestId("modal-submit"));
}

describe("ReporteFiscalModal", () => {
  it("inicializa con las fechas del mes y adapta los campos según el modo (ventas/compras)", () => {
    const { rerender } = render(<ReporteFiscalModal onClose={onCloseMock} />);

    // Fechas por defecto del mes sugerido
    expect(screen.getByTestId("reporte-fiscal-desde")).toHaveValue("2026-10-01");
    expect(screen.getByTestId("reporte-fiscal-hasta")).toHaveValue("2026-10-31");

    // Modo ventas inicial: muestra campos de ventas y no los de compras
    expect(screen.getByTestId("reporte-fiscal-documento")).toBeInTheDocument();
    expect(screen.queryByTestId("reporte-fiscal-operacion")).not.toBeInTheDocument();

    // Cambio a compras: intercambia los campos del formulario
    fireEvent.click(screen.getByTestId("reporte-fiscal-tipo-compras"));
    expect(screen.queryByTestId("reporte-fiscal-documento")).not.toBeInTheDocument();
    expect(screen.getByTestId("reporte-fiscal-operacion")).toBeInTheDocument();

    // Si no tiene permisos de ventas, abre directamente en compras
    rerender(<ReporteFiscalModal onClose={onCloseMock} canViewVentas={false} />);
    expect(screen.queryByTestId("reporte-fiscal-tipo-ventas")).not.toBeInTheDocument();
    expect(screen.getByTestId("reporte-fiscal-operacion")).toBeInTheDocument();
  });

  it("bloquea la descarga y muestra un alerta si los filtros son inválidos", async () => {
    render(<ReporteFiscalModal onClose={onCloseMock} />);

    fireEvent.change(screen.getByTestId("reporte-fiscal-desde"), { target: { value: "" } });
    submitForm();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("descarga el reporte de ventas con los parámetros seleccionados", async () => {
    const getDownload = mockBlobDownload();
    render(<ReporteFiscalModal onClose={onCloseMock} />);

    selectDropdown("reporte-fiscal-documento", "NOTA_CREDITO");
    selectDropdown("reporte-fiscal-formato", "csv");
    submitForm();

    await waitFor(() => expect(onCloseMock).toHaveBeenCalledTimes(1));

    const [requestUrl] = fetchMock.mock.calls[0];
    const params = new URL(String(requestUrl), "https://local.test").searchParams;

    expect(requestUrl).toMatch(/^\/api\/facturas\/export\?/);
    expect(params.get("documentoTipo")).toBe("NOTA_CREDITO");
    expect(params.get("format")).toBe("csv");
    expect(getDownload()?.filename).toBe("reporte-fiscal-ventas-2026-10-01_2026-10-31.csv");
  });

  it("descarga el reporte de compras con su endpoint y filtros correspondientes", async () => {
    const getDownload = mockBlobDownload();
    render(<ReporteFiscalModal onClose={onCloseMock} />);

    fireEvent.click(screen.getByTestId("reporte-fiscal-tipo-compras"));
    selectDropdown("reporte-fiscal-operacion", "COMPRA");
    submitForm();

    await waitFor(() => expect(onCloseMock).toHaveBeenCalledTimes(1));

    const [requestUrl] = fetchMock.mock.calls[0];
    const params = new URL(String(requestUrl), "https://local.test").searchParams;

    expect(requestUrl).toMatch(/^\/api\/comprobantes-recibidos\/export\?/);
    expect(params.get("tipoOperacion")).toBe("COMPRA");
    expect(getDownload()?.filename).toBe("reporte-fiscal-compras-2026-10-01_2026-10-31.xlsx");
  });

  it("deshabilita los controles mientras se genera el reporte", () => {
    fetchMock.mockReturnValueOnce(new Promise(() => {})); // Petición pendiente
    render(<ReporteFiscalModal onClose={onCloseMock} />);

    submitForm();

    expect(screen.getByTestId("modal-submit")).toBeDisabled();
    expect(screen.getByTestId("reporte-fiscal-desde")).toBeDisabled();
  });

  it("muestra un alerta sin cerrar el modal si la API responde con error", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Fallo del servidor" }), { status: 500 }),
    );
    render(<ReporteFiscalModal onClose={onCloseMock} />);

    submitForm();

    expect(await screen.findByRole("alert")).toHaveTextContent("Fallo del servidor");
    expect(onCloseMock).not.toHaveBeenCalled();
  });
});

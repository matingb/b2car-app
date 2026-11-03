import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReporteFiscalModal from "./ReporteFiscalModal";

// Exercise form state/validation independently of the calendar grid's own tests.
vi.mock("@/app/components/ui/Calendar", () => ({ default: ({ value, onChange, dataTestId }: { value: string; onChange: (value: string) => void; dataTestId: string }) => (
  <input aria-label={dataTestId} value={value} onChange={e => onChange(e.target.value)} />
) }));
const fetchMock = vi.fn(), closed = vi.fn(), anchorClick = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-01T01:30:00Z"));
  // new Date() must also use the fake instant: Buenos Aires is still October.
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-01T01:30:00Z"));
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:fiscal") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(anchorClick);
  fetchMock.mockResolvedValue(new Response("archivo", { status: 200 }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("formulario propio de reporte fiscal", () => {
  it("muestra alcance y mes sugerido GMT-3, sin datos del listado", () => {
    render(<ReporteFiscalModal onClose={closed} />);
    expect(screen.getByText("Comprobantes autorizados")).toBeInTheDocument();
    expect(screen.getByText(/ambiente configurado para facturación/)).toBeInTheDocument();
    expect(screen.getByLabelText("reporte-fiscal-desde")).toHaveValue("2026-10-01");
    expect(screen.getByLabelText("reporte-fiscal-hasta")).toHaveValue("2026-10-31");
    expect(screen.getByLabelText("Documento del reporte")).toHaveValue("");
    expect(screen.getByLabelText("Origen del reporte")).toHaveValue("");
    expect(screen.getByLabelText("CUIT emisor (opcional)")).toHaveValue("");
    expect(screen.queryByText(/provincia/i)).not.toBeInTheDocument();
  });
  it.each([
    ["reporte-fiscal-desde", "", /fechas válidas/],
    ["reporte-fiscal-hasta", "2026-02-30", /fechas válidas/],
    ["reporte-fiscal-desde", "2026-11-01", /anterior o igual/],
    ["CUIT emisor (opcional)", "123", /11 dígitos/],
  ])("valida %s antes de descargar", async (label, value, error) => {
    render(<ReporteFiscalModal onClose={closed} />);
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Descargar reporte" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(error); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("envía solo filtros explícitos y descarga nombre estable", async () => {
    render(<ReporteFiscalModal onClose={closed} />);
    fireEvent.change(screen.getByLabelText("Documento del reporte"), { target: { value: "NOTA_CREDITO" } });
    fireEvent.change(screen.getByLabelText("Origen del reporte"), { target: { value: "VENTA" } });
    fireEvent.change(screen.getByLabelText("CUIT emisor (opcional)"), { target: { value: "20111111112" } });
    fireEvent.change(screen.getByLabelText("Formato del reporte"), { target: { value: "csv" } });
    fireEvent.click(screen.getByRole("button", { name: "Descargar reporte" }));
    await waitFor(() => expect(closed).toHaveBeenCalled());
    const query = new URL(String(fetchMock.mock.calls[0][0]), "https://local.test").searchParams;
    expect(Object.fromEntries(query)).toEqual({ reporte: "fiscal", format: "csv", desde: "2026-10-01", hasta: "2026-10-31", documentoTipo: "NOTA_CREDITO", origenTipo: "VENTA", cuitEmisor: "20111111112" });
    expect(fetchMock.mock.calls[0][1]).toEqual({ cache: "no-store" });
    const anchor = anchorClick.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("reporte-fiscal-ventas-2026-10-01_2026-10-31.csv");
  });
  it("muestra fallo de generación sin cerrar ni entregar un archivo", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "No se pudo generar el reporte fiscal completo" }), { status: 500 }));
    render(<ReporteFiscalModal onClose={closed} />);
    fireEvent.click(screen.getByRole("button", { name: "Descargar reporte" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo generar el reporte fiscal completo");
    expect(closed).not.toHaveBeenCalled(); expect(anchorClick).not.toHaveBeenCalled();
  });
});

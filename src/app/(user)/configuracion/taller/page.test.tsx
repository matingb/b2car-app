import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import TalleresPage from "./page";
import type { Taller } from "@/model/types";

const mockUpdateTaller = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockSetTallerSeleccionadoId = vi.fn();

let mockTalleres: Taller[] = [];
let mockLoading = false;
let mockSelectedTallerId = "";

vi.mock("@/app/providers/TenantProvider", () => ({
  useTenant: () => ({
    talleres: mockTalleres,
    loading: mockLoading,
    updateTaller: mockUpdateTaller,
    tallerSeleccionadoId: mockSelectedTallerId || mockTalleres[0]?.id || "",
    setTallerSeleccionadoId: mockSetTallerSeleccionadoId,
  }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
  }),
}));

vi.mock("@/app/components/ui/ScreenHeader", () => ({
  default: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div data-testid="screen-header">
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  ),
}));

vi.mock("@/app/components/ui/TallerSelector", () => ({
  default: ({ value, onChange }: { value?: string; onChange?: (id: string) => void }) =>
    mockTalleres.length > 1 ? (
      <select
        data-testid="taller-selector"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      >
        {mockTalleres.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre}
          </option>
        ))}
      </select>
    ) : null,
}));

describe("TalleresPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTalleres = [];
    mockLoading = false;
    mockSelectedTallerId = "";
  });

  it("muestra spinner mientras carga y no hay talleres", () => {
    mockLoading = true;
    render(<TalleresPage />);
    expect(screen.queryByText("Guardar cambios")).not.toBeInTheDocument();
  });

  it("muestra estado vacío si no hay talleres", () => {
    mockLoading = false;
    mockTalleres = [];
    render(<TalleresPage />);
    expect(screen.getByText("No hay talleres configurados para este negocio.")).toBeInTheDocument();
  });

  it("renderiza el formulario con los datos del taller", () => {
    mockTalleres = [
      {
        id: "tal-1",
        nombre: "Taller Principal",
        ubicacion: "Av. Belgrano 100",
        valor_hora: 14000,
      },
    ];

    render(<TalleresPage />);

    expect(screen.getByLabelText(/Nombre del taller/i)).toHaveValue("Taller Principal");
    expect(screen.getByLabelText(/Ubicación/i)).toHaveValue("Av. Belgrano 100");
    expect(screen.getByLabelText(/Precio Hora/i)).toHaveValue(14000);
  });

  it("valida nombre obligatorio antes de guardar", async () => {
    mockTalleres = [
      {
        id: "tal-1",
        nombre: "Taller Principal",
        ubicacion: "Av. Belgrano 100",
        valor_hora: 14000,
      },
    ];

    render(<TalleresPage />);

    const nombreInput = screen.getByLabelText(/Nombre del taller/i);
    fireEvent.change(nombreInput, { target: { value: "   " } });

    const submitButton = screen.getByRole("button", { name: /Guardar cambios/i });
    fireEvent.click(submitButton);

    expect(mockToastError).toHaveBeenCalledWith("Error de validación", "El nombre del taller es obligatorio.");
    expect(mockUpdateTaller).not.toHaveBeenCalled();
  });

  it("guarda los cambios correctamente llamando a updateTaller y mostrando toast de éxito", async () => {
    mockTalleres = [
      {
        id: "tal-1",
        nombre: "Taller Principal",
        ubicacion: "Av. Belgrano 100",
        valor_hora: 14000,
      },
    ];
    mockUpdateTaller.mockResolvedValue({ data: null, error: null });

    render(<TalleresPage />);

    const valorHoraInput = screen.getByLabelText(/Precio Hora/i);
    fireEvent.change(valorHoraInput, { target: { value: "18500" } });

    const submitButton = screen.getByRole("button", { name: /Guardar cambios/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockUpdateTaller).toHaveBeenCalledWith("tal-1", {
        nombre: "Taller Principal",
        ubicacion: "Av. Belgrano 100",
        valor_hora: 18500,
      });
      expect(mockToastSuccess).toHaveBeenCalledWith("Taller guardado", "Los datos se actualizaron correctamente.");
    });
  });

  it("permite seleccionar entre múltiples talleres con TallerSelector y editar el taller seleccionado", async () => {
    mockTalleres = [
      { id: "tal-1", nombre: "Taller 1", ubicacion: "Calle 1", valor_hora: 10000 },
      { id: "tal-2", nombre: "Taller 2", ubicacion: "Calle 2", valor_hora: 20000 },
    ];
    mockUpdateTaller.mockResolvedValue({ data: null, error: null });

    const { rerender } = render(<TalleresPage />);

    const selector = screen.getByTestId("taller-selector");
    expect(selector).toBeInTheDocument();

    // Initially Taller 1 is selected
    expect(screen.getByLabelText(/Nombre del taller/i)).toHaveValue("Taller 1");
    expect(screen.getByLabelText(/Precio Hora/i)).toHaveValue(10000);

    // Switch to Taller 2
    fireEvent.change(selector, { target: { value: "tal-2" } });
    expect(mockSetTallerSeleccionadoId).toHaveBeenCalledWith("tal-2");
    mockSelectedTallerId = "tal-2";
    rerender(<TalleresPage />);

    expect(screen.getByLabelText(/Nombre del taller/i)).toHaveValue("Taller 2");
    expect(screen.getByLabelText(/Precio Hora/i)).toHaveValue(20000);

    // Edit and save Taller 2
    const valorHoraInput = screen.getByLabelText(/Precio Hora/i);
    fireEvent.change(valorHoraInput, { target: { value: "25000" } });

    fireEvent.click(screen.getByRole("button", { name: /Guardar cambios/i }));

    await waitFor(() => {
      expect(mockUpdateTaller).toHaveBeenCalledWith("tal-2", {
        nombre: "Taller 2",
        ubicacion: "Calle 2",
        valor_hora: 25000,
      });
    });
  });
});

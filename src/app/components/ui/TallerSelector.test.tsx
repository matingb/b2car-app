import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TallerSelector from "./TallerSelector";
import type { Taller } from "@/model/types";

const mockTalleres: Taller[] = [
  { id: "t1", nombre: "Taller Norte", ubicacion: "Av. Siempre Viva 123" },
  { id: "t2", nombre: "Taller Sur", ubicacion: "Calle Falsa 456" },
];

const mockSetTallerSeleccionadoId = vi.fn();
let currentTalleres: Taller[] = mockTalleres;
let currentTallerSeleccionadoId = "t1";

vi.mock("@/app/providers/TenantProvider", () => ({
  useTenant: () => ({
    talleres: currentTalleres,
    tallerSeleccionadoId: currentTallerSeleccionadoId,
    setTallerSeleccionadoId: mockSetTallerSeleccionadoId,
  }),
}));

describe("TallerSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentTalleres = mockTalleres;
    currentTallerSeleccionadoId = "t1";
  });

  it("retorna null si hay 1 solo taller", () => {
    currentTalleres = [mockTalleres[0]!];
    const { container } = render(<TallerSelector />);
    expect(container.firstChild).toBeNull();
  });

  it("retorna null si la lista de talleres está vacía", () => {
    currentTalleres = [];
    const { container } = render(<TallerSelector />);
    expect(container.firstChild).toBeNull();
  });

  it("renderiza el label 'Taller' y el taller seleccionado cuando hay más de 1 taller", () => {
    render(<TallerSelector />);
    expect(screen.getByText("Taller")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Taller Norte")).toBeInTheDocument();
  });

  it("incluye la opción general al inicio cuando se especifica allOption", async () => {
    const user = userEvent.setup();
    render(
      <TallerSelector
        allOption="Vista general"
        value=""
        onChange={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue("Vista general")).toBeInTheDocument();

    await user.click(screen.getByDisplayValue("Vista general"));
    expect(screen.getByText("Vista general")).toBeInTheDocument();
    expect(screen.getByText("Taller Norte")).toBeInTheDocument();
    expect(screen.getByText("Taller Sur")).toBeInTheDocument();
  });

  it("llama a setTallerSeleccionadoId de useTenant por defecto al seleccionar otra opción", async () => {
    const user = userEvent.setup();
    render(<TallerSelector />);

    await user.click(screen.getByDisplayValue("Taller Norte"));
    await user.click(screen.getByText("Taller Sur"));

    expect(mockSetTallerSeleccionadoId).toHaveBeenCalledWith("t2");
  });

  it("llama al callback onChange personalizado si se proporciona", async () => {
    const customOnChange = vi.fn();
    const user = userEvent.setup();
    render(<TallerSelector value="t1" onChange={customOnChange} />);

    await user.click(screen.getByDisplayValue("Taller Norte"));
    await user.click(screen.getByText("Taller Sur"));

    expect(customOnChange).toHaveBeenCalledWith("t2");
    expect(mockSetTallerSeleccionadoId).not.toHaveBeenCalled();
  });
});

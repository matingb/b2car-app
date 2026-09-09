import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import VehiculosAsociadosCard from "./VehiculosAsociadosCard";
import { createVehiculo } from "@/tests/factories";
import { ROUTES } from "@/routing/routes";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("VehiculosAsociadosCard", () => {
  it("renderiza la lista de vehículos usando VehiculoCard", () => {
    const vehiculos = [
      createVehiculo({
        id: "veh-1",
        patente: "AB123CD",
        marca: "Toyota",
        modelo: "Corolla",
        fecha_patente: "2021",
        nro_interno: "10",
      }),
      createVehiculo({
        id: "veh-2",
        patente: "XYZ789",
        marca: "Ford",
        modelo: "Focus",
        fecha_patente: "2019",
      }),
    ];

    render(<VehiculosAsociadosCard vehiculos={vehiculos} />);

    expect(screen.getByText("2 vehículos asociados")).toBeInTheDocument();
    expect(screen.getByText("AB123CD")).toBeInTheDocument();
    expect(screen.getByText("Toyota Corolla")).toBeInTheDocument();
    expect(screen.getByText("XYZ789")).toBeInTheDocument();
    expect(screen.getByText("Ford Focus")).toBeInTheDocument();
    expect(screen.getByText("INT 10")).toBeInTheDocument();
  });

  it("navega al detalle del vehículo al hacer click en el card", async () => {
    const vehiculos = [
      createVehiculo({
        id: "veh-1",
        patente: "AB123CD",
        marca: "Toyota",
        modelo: "Corolla",
      }),
    ];

    render(<VehiculosAsociadosCard vehiculos={vehiculos} />);

    await userEvent.click(screen.getByTestId("vehiculo-card"));
    expect(mockPush).toHaveBeenCalledWith(`${ROUTES.vehiculos}/veh-1`);
  });

  it("renderiza el estado vacío cuando no hay vehículos", () => {
    render(<VehiculosAsociadosCard vehiculos={[]} />);

    expect(screen.getByText("No hay vehículos asociados")).toBeInTheDocument();
    expect(
      screen.getByText("Este cliente aún no tiene vehículos registrados en el sistema.")
    ).toBeInTheDocument();
  });

  it("ejecuta onAddVehiculo al hacer click en el botón de agregar vehículo", async () => {
    const onAdd = vi.fn();
    render(<VehiculosAsociadosCard vehiculos={[]} onAddVehiculo={onAdd} />);

    const buttons = screen.getAllByRole("button", { name: /agregar vehículo/i });
    expect(buttons.length).toBeGreaterThan(0);
    await userEvent.click(buttons[0]);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});

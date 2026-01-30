import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ArregloItem from "@/app/components/arreglos/ArregloItem";
import { createArreglo } from "@/tests/factories";

let talleresMock: Array<{ id: string; nombre: string; ubicacion: string }> = [];

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/app/providers/TenantProvider", () => ({
  useTenant: () => ({
    talleres: talleresMock,
    tallerSeleccionadoId: talleresMock[0]?.id ?? "",
    setTallerSeleccionadoId: vi.fn(),
  }),
}));

vi.mock("@/app/components/arreglos/ArregloModal", () => ({
  __esModule: true,
  default: () => null,
}));

describe("ArregloItem", () => {
  it("si hay más de un taller, muestra el IconLabel de Taller", () => {
    talleresMock = [
      { id: "t1", nombre: "Taller 1", ubicacion: "A" },
      { id: "t2", nombre: "Taller 2", ubicacion: "B" },
    ];

    render(
      <ArregloItem
        arreglo={createArreglo({
          taller: { id: "t2", nombre: "Taller 2", ubicacion: "B" },
        })}
      />
    );

    expect(screen.getByTestId("arreglo-item-taller-label")).toBeInTheDocument();
    expect(screen.getByText("Taller 2")).toBeInTheDocument();
  });

  it("si hay un único taller, NO muestra el IconLabel de Taller", () => {
    talleresMock = [{ id: "t1", nombre: "Taller 1", ubicacion: "A" }];

    render(
      <ArregloItem
        arreglo={createArreglo({
          taller: { id: "t1", nombre: "Taller 1", ubicacion: "A" },
        })}
      />
    );

    expect(screen.queryByTestId("arreglo-item-taller-label")).not.toBeInTheDocument();
    expect(screen.queryByText("Taller 1")).not.toBeInTheDocument();
  });
});


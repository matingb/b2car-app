import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TipoCliente } from "@/model/types";

const getClienteById = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "cliente-1" }),
}));

vi.mock("@/app/providers/ClientesProvider", () => ({
  useClientes: () => ({ getClienteById }),
}));

vi.mock("@/app/providers/VehiculosProvider", () => ({
  VehiculosProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/app/components/ui/ScreenHeader", () => ({
  default: () => <div>Encabezado de cliente</div>,
}));

vi.mock("@/app/components/screens/ParticularDetails", () => ({
  default: () => <div>Detalle particular</div>,
}));

vi.mock("@/app/components/screens/EmpresaDetails", () => ({
  default: () => <div>Detalle empresa</div>,
}));

import ClientesDetailsPage from "./page";

describe("ClientesDetailsPage", () => {
  beforeEach(() => {
    getClienteById.mockReset();
  });

  it("muestra el detalle particular cuando el response informa su tipo", async () => {
    getClienteById.mockResolvedValue({
      id: "cliente-1",
      nombre: "Ana Perez",
      tipo_cliente: TipoCliente.PARTICULAR,
    });

    render(<ClientesDetailsPage />);

    expect(screen.getByText("Cargando...")).toBeInTheDocument();
    expect(await screen.findByText("Detalle particular")).toBeInTheDocument();
    expect(screen.queryByText(/No se encontro/)).not.toBeInTheDocument();
  });

  it("muestra el detalle empresa cuando el response informa su tipo", async () => {
    getClienteById.mockResolvedValue({
      id: "cliente-1",
      nombre: "Taller SA",
      tipo_cliente: TipoCliente.EMPRESA,
    });

    render(<ClientesDetailsPage />);

    expect(await screen.findByText("Detalle empresa")).toBeInTheDocument();
  });

  it("muestra no encontrado solamente despues de terminar la consulta", async () => {
    getClienteById.mockResolvedValue(null);

    render(<ClientesDetailsPage />);

    expect(screen.getByText("Cargando...")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/No se encontr/)).toBeInTheDocument();
    });
  });
});

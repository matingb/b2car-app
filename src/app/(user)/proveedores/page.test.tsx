import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProveedoresPage from "./page";
import type { PermissionValue } from "@/lib/permissions";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/app/providers/ModalMessageProvider", () => ({
  useModalMessage: () => ({ confirm: vi.fn() }),
}));

vi.mock("@/app/providers/SheetProvider", () => ({
  useSheet: () => ({ openSheet: vi.fn() }),
}));

let mockHasPermission = (_permission: PermissionValue) => Boolean(_permission);
vi.mock("@/app/providers/TenantProvider", () => ({
  useTenant: () => ({
    hasPermission: (p: PermissionValue) => mockHasPermission(p),
  }),
}));

const mockProveedores: Proveedor[] = [
  {
    id: "prov-1",
    nombre: "Distribuidora Warnes SRL",
    cuit: "30-71234567-8",
    telefono: "11 4455-6677",
    email: "ventas@warnes.com",
    direccion: "Av. Warnes 1234",
  },
  {
    id: "prov-2",
    nombre: "Baterías del Sur",
    cuit: null,
    telefono: "11 9988-7766",
    email: "contacto@baterias.com",
    direccion: "Av. Mitre 500",
  },
];

let mockLoading = false;
const mockCreateProveedor = vi.fn();
const mockUpdateProveedor = vi.fn();
const mockDeleteProveedor = vi.fn();

vi.mock("@/app/providers/ProveedoresProvider", () => ({
  useProveedores: () => ({
    proveedores: mockProveedores,
    loading: mockLoading,
    createProveedor: mockCreateProveedor,
    updateProveedor: mockUpdateProveedor,
    deleteProveedor: mockDeleteProveedor,
    refresh: vi.fn(),
  }),
}));

describe("ProveedoresPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoading = false;
    mockHasPermission = () => true;
  });

  it("renderiza el listado con los proveedores", () => {
    render(<ProveedoresPage />);

    expect(screen.getByText("Proveedores")).toBeInTheDocument();
    expect(screen.getByText("Distribuidora Warnes SRL")).toBeInTheDocument();
    expect(screen.getByText("Baterías del Sur")).toBeInTheDocument();
    expect(screen.getByText("CUIT: 30-71234567-8")).toBeInTheDocument();
  });

  it("filtra proveedores al escribir en el buscador", () => {
    render(<ProveedoresPage />);

    const searchInput = screen.getByTestId("proveedores-search");
    fireEvent.change(searchInput, { target: { value: "Warnes" } });

    expect(screen.getByText("Distribuidora Warnes SRL")).toBeInTheDocument();
    expect(screen.queryByText("Baterías del Sur")).not.toBeInTheDocument();
  });

  it("muestra estado vacío cuando la búsqueda no coincide con ningún proveedor", () => {
    render(<ProveedoresPage />);

    const searchInput = screen.getByTestId("proveedores-search");
    fireEvent.change(searchInput, { target: { value: "Inexistente XYZ" } });

    expect(screen.getByText("No se encontraron proveedores")).toBeInTheDocument();
  });

  it("abre el modal de nuevo proveedor al hacer clic en el botón", () => {
    render(<ProveedoresPage />);

    const newBtn = screen.getByTestId("proveedor-open-create");
    fireEvent.click(newBtn);

    expect(screen.getByTestId("modal-title")).toHaveTextContent("Nuevo Proveedor");
    expect(screen.getByTestId("proveedor-input-nombre")).toBeInTheDocument();
  });

  it("navega al detalle del proveedor al hacer clic en su tarjeta", () => {
    render(<ProveedoresPage />);

    const card = screen.getByTestId("proveedor-card-prov-1");
    fireEvent.click(card);

    expect(mockPush).toHaveBeenCalledWith("/proveedores/prov-1");
  });
});

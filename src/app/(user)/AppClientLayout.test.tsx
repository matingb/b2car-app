import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppClientLayout from "./AppClientLayout";
import { Permission } from "@/lib/permissions";

const mockReplace = vi.fn();
let mockPathname = "/arreglos";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  usePathname: () => mockPathname,
}));

vi.mock("@/clients/tenantClient", () => ({
  tenantClient: {
    getAll: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

vi.mock("@/clients/finanzasClient", () => ({
  finanzasClient: {
    listarCuentas: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

vi.mock("@/app/login/actions", () => ({
  logOut: vi.fn(),
}));

describe("AppClientLayout visual route guard", () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it("permite el acceso y renderiza los hijos cuando el pathname es permitido", () => {
    mockPathname = "/arreglos";

    render(
      <AppClientLayout initialPermissions={[Permission.ArreglosView]}>
        <div data-testid="protected-content">Contenido Arreglos</div>
      </AppClientLayout>,
    );

    expect(screen.getByTestId("protected-content")).toBeDefined();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("bloquea el contenido y redirige a /arreglos cuando un rol operativo intenta acceder a /dashboard", () => {
    mockPathname = "/dashboard";

    render(
      <AppClientLayout initialPermissions={[Permission.ArreglosView, Permission.ArreglosEdit]}>
        <div data-testid="protected-content">Contenido Dashboard</div>
      </AppClientLayout>,
    );

    expect(screen.queryByTestId("protected-content")).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith("/arreglos");
  });

  it("bloquea el contenido y redirige a /dashboard cuando un admin en plan BASE intenta acceder a /facturacion", () => {
    mockPathname = "/facturacion";

    // Admin con DashboardView pero sin FacturasView
    render(
      <AppClientLayout initialPermissions={[Permission.DashboardView, Permission.OperacionesView]}>
        <div data-testid="protected-content">Contenido Facturación</div>
      </AppClientLayout>,
    );

    expect(screen.queryByTestId("protected-content")).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith("/dashboard");
  });
});

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppClientLayout from "./AppClientLayout";
import { Permission } from "@/lib/permissions";
import { telemetry } from "@/lib/telemetry";

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
    vi.clearAllMocks();
  });

  it("asocia el tenant_id, tenant_name y plan a telemetría", () => {
    const setUserSpy = vi.spyOn(telemetry, "setUser");
    render(
      <AppClientLayout
        initialPermissions={[Permission.ArreglosView]}
        tenantId="t-123"
        tenantName="Taller Demo"
        plan="BASE"
      >
        <div>contenido</div>
      </AppClientLayout>
    );

    expect(setUserSpy).toHaveBeenCalledWith({
      id: "t-123",
      name: "Taller Demo",
      plan_sub: "BASE",
    });
  });

  it("asocia identity con user y account a telemetría si se pasa identity", () => {
    const identifySpy = vi.spyOn(telemetry, "identify");
    render(
      <AppClientLayout
        initialPermissions={[Permission.ArreglosView]}
        identity={{
          user: { id: "u-456", email: "test@user.com" },
          account: { id: "t-123", name: "Taller Demo", plan: "PRO" },
        }}
      >
        <div>contenido</div>
      </AppClientLayout>
    );

    expect(identifySpy).toHaveBeenCalledWith({
      user: { id: "u-456", email: "test@user.com" },
      account: { id: "t-123", name: "Taller Demo", plan: "PRO" },
    });
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

  it("redirige a productos si es el único módulo permitido", () => {
    mockPathname = "/arreglos";
    render(
      <AppClientLayout initialPermissions={[Permission.ProductosView]}>
        <div data-testid="protected-content">Contenido Arreglos</div>
      </AppClientLayout>,
    );
    expect(screen.queryByTestId("protected-content")).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith("/productos");
  });

  it("bloquea el contenido y evita ciclos de redirección si no tiene permisos", () => {
    mockPathname = "/arreglos";
    render(
      <AppClientLayout initialPermissions={[]}>
        <div data-testid="protected-content">Contenido Arreglos</div>
      </AppClientLayout>,
    );
    expect(screen.queryByTestId("protected-content")).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });
});

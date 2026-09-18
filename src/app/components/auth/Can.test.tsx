import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Can from "./Can";
import { TenantTestProvider, renderWithProviders, mockHasPermission } from "@/tests/testUtils";
import { Permission, UserRole } from "@/lib/permissions";

describe("<Can /> Component", () => {
  it("throws an error when rendered outside TenantProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => {
      render(
        <Can permission={Permission.ArreglosPreciosView} fallback={<span>No access</span>}>
          <span>Price Content</span>
        </Can>
      );
    }).toThrow("useTenant debe usarse dentro de TenantProvider");
    spy.mockRestore();
  });

  it("renders children with generic wrapper renderWithProviders", () => {
    renderWithProviders(
      <Can permission={Permission.ArreglosPreciosView} fallback={<span>No access</span>}>
        <span>Price Content</span>
      </Can>
    );
    expect(screen.getByText("Price Content")).toBeInTheDocument();
    expect(screen.queryByText("No access")).not.toBeInTheDocument();
  });

  it("renders children when user has the requested permission", () => {
    render(
      <TenantTestProvider
        hasPermission={mockHasPermission(UserRole.Admin)}
      >
        <Can permission={Permission.ArreglosPreciosView} fallback={<span>Blocked</span>}>
          <span>Admin Price Content</span>
        </Can>
      </TenantTestProvider>
    );
    expect(screen.getByText("Admin Price Content")).toBeInTheDocument();
    expect(screen.queryByText("Blocked")).not.toBeInTheDocument();
  });

  it("renders fallback when user lacks the requested permission", () => {
    render(
      <TenantTestProvider
        hasPermission={mockHasPermission(UserRole.Operativo)}
      >
        <Can permission={Permission.ArreglosPreciosView} fallback={<span>Sin precio</span>}>
          <span>Secret Price</span>
        </Can>
      </TenantTestProvider>
    );
    expect(screen.getByText("Sin precio")).toBeInTheDocument();
    expect(screen.queryByText("Secret Price")).not.toBeInTheDocument();
  });

  it("evaluates multiple required permissions using array in permission", () => {
    render(
      <TenantTestProvider
        hasPermission={mockHasPermission(UserRole.Operativo)}
      >
        <Can
          permission={[Permission.ArreglosView, Permission.ArreglosPreciosView]}
          fallback={<span>Denied</span>}
        >
          <span>Both granted</span>
        </Can>
      </TenantTestProvider>
    );
    // Operativo has ArreglosView but NOT ArreglosPreciosView -> should be Denied
    expect(screen.getByText("Denied")).toBeInTheDocument();
  });

  it("evaluates anyPermissions when at least one matches", () => {
    render(
      <TenantTestProvider
        hasPermission={mockHasPermission(UserRole.Operativo)}
      >
        <Can
          anyPermissions={[Permission.ArreglosPreciosView, Permission.ArreglosView]}
          fallback={<span>Denied</span>}
        >
          <span>At least one granted</span>
        </Can>
      </TenantTestProvider>
    );
    expect(screen.getByText("At least one granted")).toBeInTheDocument();
  });

  it("evaluates path prop correctly", () => {
    render(
      <TenantTestProvider
        hasPermission={mockHasPermission(UserRole.Operativo)}
      >
        <Can path="/dashboard" fallback={<span>No Dashboard</span>}>
          <span>Dashboard Content</span>
        </Can>
        <Can path="/arreglos" fallback={<span>No Arreglos</span>}>
          <span>Arreglos Content</span>
        </Can>
      </TenantTestProvider>
    );

    // Operativo no puede acceder a /dashboard, pero sí a /arreglos
    expect(screen.getByText("No Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard Content")).not.toBeInTheDocument();
    expect(screen.getByText("Arreglos Content")).toBeInTheDocument();
    expect(screen.queryByText("No Arreglos")).not.toBeInTheDocument();
  });
});

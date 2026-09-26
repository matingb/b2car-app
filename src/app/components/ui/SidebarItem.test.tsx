import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SidebarItem from "./SidebarItem";

const state = vi.hoisted(() => ({ pathname: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
}));

afterEach(() => {
  state.pathname = "/dashboard";
});

describe("SidebarItem", () => {
  it("Si el item está deshabilitado, no se ejecuta onClick", async () => {
    const onClick = vi.fn();

    render(<SidebarItem href="/clientes" label="Clientes" onClick={onClick} disabled />);

    await userEvent.click(screen.getByRole("link", { name: "Clientes" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("Si el item está en estado de carga, se muestra el spinner", async () => {
    const onClick = vi.fn();

    render(
      <SidebarItem
        href="/clientes"
        label="Clientes"
        onClick={onClick}
        isLoading
      />
    );

    expect(screen.getByTestId("sidebar-item-spinner")).toBeInTheDocument();
  });

  it("marca Configuración y no Facturas en la pestaña fiscal", () => {
    state.pathname = "/configuracion/facturacion";
    render(
      <>
        <SidebarItem href="/facturacion" label="Facturas" />
        <SidebarItem href="/configuracion" label="Configuración" />
      </>,
    );

    expect(screen.getByRole("link", { name: "Facturas" })).not.toHaveClass("active");
    expect(screen.getByRole("link", { name: "Configuración" })).toHaveClass("active");
  });

  it("marca Facturas en sus rutas de detalle", () => {
    state.pathname = "/facturacion/factura-1";
    render(<SidebarItem href="/facturacion" label="Facturas" />);
    expect(screen.getByRole("link", { name: "Facturas" })).toHaveClass("active");
  });
});


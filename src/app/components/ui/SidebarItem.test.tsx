import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SidebarItem from "./SidebarItem";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

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
});


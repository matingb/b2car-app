import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MenuSheet from "./MenuSheet";
import { SidebarMenuKey } from "@/app/hooks/useSidebarMenu";

const closeSheet = vi.fn();
const itemAction = vi.fn();

vi.mock("@/app/providers/SheetProvider", () => ({
  useSheet: () => ({ closeSheet }),
}));

vi.mock("@/app/hooks/useSidebarMenu", () => ({
  SidebarMenuKey: {
    Dashboard: "dashboard",
    Clientes: "clientes",
    Vehiculos: "vehiculos",
    Arreglos: "arreglos",
    Logout: "logout",
  },
  useSidebarMenu: () => ({
    tenantName: "B2Car",
    items: [
      {
        key: SidebarMenuKey.Dashboard,
        href: "/dashboard",
        label: "Dashboard",
        onClick: itemAction,
      },
    ],
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("MenuSheet", () => {
  it("Cierra el sheet después de la acción del item", async () => {
    render(<MenuSheet />);

    await userEvent.click(screen.getByLabelText("Dashboard"));

    expect(itemAction).toHaveBeenCalledTimes(1);
    expect(closeSheet).toHaveBeenCalledTimes(1);
  });
});


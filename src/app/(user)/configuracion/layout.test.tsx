import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConfiguracionLayout from "./layout";
import { UserRole, type PermissionValue } from "@/lib/permissions";
import { SubscriptionPlan } from "@/lib/subscription";
import { mockHasPermission } from "@/tests/testUtils";

const state = vi.hoisted(() => ({
  pathname: "/configuracion/taller",
  role: "admin",
  plan: "PRO",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
}));

vi.mock("@/app/providers/TenantProvider", () => ({
  useTenant: () => ({
    hasPermission: (permission: PermissionValue) => mockHasPermission(
      state.role as typeof UserRole[keyof typeof UserRole],
      state.plan as typeof SubscriptionPlan[keyof typeof SubscriptionPlan],
    )(permission),
  }),
}));

vi.mock("@/app/components/ui/ScreenHeader", () => ({
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

afterEach(() => {
  state.pathname = "/configuracion/taller";
  state.role = UserRole.Admin;
  state.plan = SubscriptionPlan.Pro;
});

describe("ConfiguracionLayout", () => {
  it("muestra las cuatro pestañas a admin PRO y marca la activa", () => {
    state.pathname = "/configuracion/facturacion";
    render(<ConfiguracionLayout>Contenido</ConfiguracionLayout>);
    const nav = screen.getByRole("navigation", { name: "Secciones de configuración" });
    expect(within(nav).getAllByRole("link")).toHaveLength(4);
    expect(within(nav).getByRole("link", { name: "Facturación" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Categorías de arreglos" })).toHaveAttribute(
      "href",
      "/configuracion/categorias-arreglo"
    );
  });

  it("muestra Taller, Empleados y Categorías de arreglos a admin BASE sin Facturación", () => {
    state.plan = SubscriptionPlan.Base;
    render(<ConfiguracionLayout>Contenido</ConfiguracionLayout>);
    const nav = screen.getByRole("navigation", { name: "Secciones de configuración" });
    expect(within(nav).getAllByRole("link")).toHaveLength(3);
    expect(within(nav).getByRole("link", { name: "Taller" })).toHaveAttribute("href", "/configuracion/taller");
    expect(within(nav).getByRole("link", { name: "Empleados" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Categorías de arreglos" })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Facturación" })).not.toBeInTheDocument();
  });

  it("oculta las pestañas a un rol operativo", () => {
    state.role = UserRole.Operativo;
    render(<ConfiguracionLayout>Contenido</ConfiguracionLayout>);
    expect(within(screen.getByRole("navigation", { name: "Secciones de configuración" })).queryAllByRole("link")).toHaveLength(0);
  });
});

import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SidebarMenuKey, useSidebarMenu } from "./useSidebarMenu";
import { UserRole, type UserRoleValue, type PermissionValue } from "@/lib/permissions";
import { SubscriptionPlan } from "@/lib/subscription";
import { mockHasPermission } from "@/tests/testUtils";

const state = vi.hoisted(() => ({
  pro: true,
  role: "admin" as UserRoleValue,
}));
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/app/login/actions", () => ({
  logOut: vi.fn(),
}));

vi.mock("@/app/providers/TenantProvider", () => ({
  useTenant: () => ({
    tenantName: "B2Car",
    hasPermission: (p: PermissionValue) => {
      return mockHasPermission(state.role, state.pro ? SubscriptionPlan.Pro : SubscriptionPlan.Base)(p);
    },
    userRole: state.role,
  }),
}));

afterEach(() => {
  localStorage.clear();
  push.mockClear();
  state.pro = true;
  state.role = UserRole.Admin;
});

describe("useSidebarMenu", () => {
  it("muestra Facturas y Configuración para admin con plan PRO", () => {
    state.role = UserRole.Admin;
    state.pro = true;
    const { result } = renderHook(() => useSidebarMenu());

    expect(result.current.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: SidebarMenuKey.Configuracion,
        href: "/configuracion",
      }),
      expect.objectContaining({
        key: SidebarMenuKey.Facturas,
        href: "/facturacion",
      }),
    ]));
  });

  it("oculta Facturas y Configuración para BASE en admin", () => {
    state.role = UserRole.Admin;
    state.pro = false;
    const { result } = renderHook(() => useSidebarMenu());

    expect(result.current.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: SidebarMenuKey.Configuracion }),
    ]));
    expect(result.current.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: SidebarMenuKey.Facturas }),
    ]));
  });

  it("para rol operativo, muestra solo ítems permitidos y oculta pantallas restringidas", () => {
    state.role = UserRole.Operativo;
    state.pro = true;
    const { result } = renderHook(() => useSidebarMenu());

    const keys = result.current.items.map((i) => i.key);

    // Permitidos
    expect(keys).toContain(SidebarMenuKey.Turnos);
    expect(keys).toContain(SidebarMenuKey.Clientes);
    expect(keys).toContain(SidebarMenuKey.Vehiculos);
    expect(keys).toContain(SidebarMenuKey.Arreglos);
    expect(keys).toContain(SidebarMenuKey.Logout);

    // Ocultos
    expect(keys).not.toContain(SidebarMenuKey.Dashboard);
    expect(keys).not.toContain(SidebarMenuKey.Operaciones);
    expect(keys).not.toContain(SidebarMenuKey.CuentasFinancieras);
    expect(keys).not.toContain(SidebarMenuKey.Facturas);
    expect(keys).not.toContain(SidebarMenuKey.Empleados);
    expect(keys).not.toContain(SidebarMenuKey.Productos);
    expect(keys).not.toContain(SidebarMenuKey.Configuracion);
  });
});

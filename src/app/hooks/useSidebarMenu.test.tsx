import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SidebarMenuKey, useSidebarMenu } from "./useSidebarMenu";

const featureAccess = vi.hoisted(() => ({ pro: true }));
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
    hasFeature: () => featureAccess.pro,
  }),
}));

afterEach(() => {
  localStorage.clear();
  push.mockClear();
  featureAccess.pro = true;
});

describe("useSidebarMenu", () => {
  it("muestra Facturas y Configuración para PRO", () => {
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

  it("oculta Facturas y Configuración para BASE", () => {
    featureAccess.pro = false;
    const { result } = renderHook(() => useSidebarMenu());

    expect(result.current.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: SidebarMenuKey.Configuracion }),
    ]));
    expect(result.current.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: SidebarMenuKey.Facturas }),
    ]));
  });
});

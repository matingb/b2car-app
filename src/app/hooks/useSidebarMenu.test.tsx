import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SidebarMenuKey, useSidebarMenu } from "./useSidebarMenu";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/app/login/actions", () => ({
  logOut: vi.fn(),
}));

afterEach(() => {
  localStorage.clear();
  push.mockClear();
});

describe("useSidebarMenu", () => {
  it("muestra Configuración aunque el tenant aún no tenga datos fiscales", () => {
    const { result } = renderHook(() => useSidebarMenu());

    expect(result.current.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: SidebarMenuKey.Configuracion,
        href: "/configuracion",
      }),
    ]));
  });
});

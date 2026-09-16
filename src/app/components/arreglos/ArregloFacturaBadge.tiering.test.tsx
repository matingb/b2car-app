import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Permission } from "@/lib/permissions";

const permissionsState = vi.hoisted(() => ({ hasBilling: false }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/app/providers/ArreglosProvider", () => ({
  useArreglos: () => ({ update: vi.fn() }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/app/providers/TenantProvider", () => ({
  useTenant: () => ({
    hasPermission: (perm: string) =>
      perm === Permission.FacturasView ? permissionsState.hasBilling : true,
  }),
}));

import ArregloFacturaBadge from "./ArregloFacturaBadge";

afterEach(() => {
  permissionsState.hasBilling = false;
});

describe("ArregloFacturaBadge tiering", () => {
  it("does not render fiscal controls for BASE", () => {
    render(<ArregloFacturaBadge arregloId="arr-1" />);

    expect(screen.queryByTestId("arreglo-factura-badge")).not.toBeInTheDocument();
  });

  it("renders fiscal controls for PRO", () => {
    permissionsState.hasBilling = true;
    render(<ArregloFacturaBadge arregloId="arr-1" />);

    expect(screen.getByTestId("arreglo-factura-badge")).toBeInTheDocument();
  });
});

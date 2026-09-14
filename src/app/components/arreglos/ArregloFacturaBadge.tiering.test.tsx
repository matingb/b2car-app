import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const featureAccess = vi.hoisted(() => ({ billing: false }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/app/providers/ArreglosProvider", () => ({
  useArreglos: () => ({ update: vi.fn() }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/app/providers/TenantFeatureContext", () => ({
  useOptionalTenantFeature: () => (featureAccess.billing ? () => true : () => false),
}));

import ArregloFacturaBadge from "./ArregloFacturaBadge";

afterEach(() => {
  featureAccess.billing = false;
});

describe("ArregloFacturaBadge tiering", () => {
  it("does not render fiscal controls for BASE", () => {
    render(<ArregloFacturaBadge arregloId="arr-1" />);

    expect(screen.queryByTestId("arreglo-factura-badge")).not.toBeInTheDocument();
  });

  it("renders fiscal controls for PRO", () => {
    featureAccess.billing = true;
    render(<ArregloFacturaBadge arregloId="arr-1" />);

    expect(screen.getByTestId("arreglo-factura-badge")).toBeInTheDocument();
  });
});

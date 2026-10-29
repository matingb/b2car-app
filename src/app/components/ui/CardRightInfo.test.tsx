import React from "react";
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import CardRightInfo from "./CardRightInfo";
import { Permission } from "@/lib/permissions";
import { TenantContext, type TenantContextValue } from "@/app/providers/TenantProvider";
import { renderWithProviders } from "@/tests/testUtils";

const defaultTenantProps = {
  talleres: [
    { id: "t1", nombre: "Taller 1", ubicacion: "Dir 1" },
    { id: "t2", nombre: "Taller 2", ubicacion: "Dir 2" },
  ],
};

function render(ui: React.ReactElement) {
  return renderWithProviders(ui, {
    tenantProps: { ...defaultTenantProps, children: null },
  });
}

vi.mock("@/app/components/auth/Can", () => ({
  default: ({
    children,
    permission,
  }: {
    children: React.ReactNode;
    permission: string;
  }) => (permission === Permission.ArreglosPreciosView ? <>{children}</> : null),
}));

describe("CardRightInfo", () => {
  it("renderiza el precio, la fecha y el taller", () => {
    render(
      <CardRightInfo
        price="$15.000"
        date="28/10/2026"
        taller={{
          nombre: "Taller Central",
          ubicacion: "Av. Siempre Viva 123",
        }}
      />
    );

    expect(screen.getByTestId("card-right-info")).toBeInTheDocument();
    expect(screen.getByText("$15.000")).toBeInTheDocument();
    expect(screen.getByText("28/10/2026")).toBeInTheDocument();
    expect(screen.getByText("Taller Central")).toBeInTheDocument();
    expect(screen.getByTestId("card-right-info-taller")).toHaveAttribute(
      "title",
      "Av. Siempre Viva 123"
    );
  });

  it("acepta taller como string simple", () => {
    render(<CardRightInfo price="$20.000" date="28/10/2026" taller="Taller Norte" />);

    expect(screen.getByText("Taller Norte")).toBeInTheDocument();
  });

  it("omite el taller si es null, vacío o un guión", () => {
    const { rerender } = render(
      <CardRightInfo price="$10.000" date="28/10/2026" taller={null} />
    );
    expect(screen.queryByText(/taller/i)).toBeNull();

    rerender(<CardRightInfo price="$10.000" date="28/10/2026" taller="—" />);
    expect(screen.queryByText("—")).toBeNull();

    rerender(<CardRightInfo price="$10.000" date="28/10/2026" taller="-" />);
    expect(screen.queryByText("-")).toBeNull();
  });

  it("aplica permiso a través de Can si se provee pricePermission", () => {
    const { rerender } = render(
      <CardRightInfo
        price="$50.000"
        pricePermission={Permission.ArreglosPreciosView}
        date="28/10/2026"
      />
    );
    expect(screen.getByText("$50.000")).toBeInTheDocument();

    rerender(
      <CardRightInfo
        price="$50.000"
        pricePermission={Permission.ArreglosEdit}
        date="28/10/2026"
      />
    );
    expect(screen.queryByText("$50.000")).toBeNull();
  });

  it("oculta el taller si el tenant tiene un solo taller", () => {
    const singleTallerContext = {
      talleres: [{ id: "t1", nombre: "Taller Único", ubicacion: "Calle 1" }],
    } as unknown as TenantContextValue;

    render(
      <TenantContext.Provider value={singleTallerContext}>
        <CardRightInfo price="$10.000" date="28/10/2026" taller="Taller Único" />
      </TenantContext.Provider>
    );

    expect(screen.queryByTestId("card-right-info-taller")).not.toBeInTheDocument();
    expect(screen.queryByText("Taller Único")).not.toBeInTheDocument();
  });

  it("renderiza el taller si el tenant tiene más de un taller", () => {
    const multiTallerContext = {
      talleres: [
        { id: "t1", nombre: "Taller 1", ubicacion: "Calle 1" },
        { id: "t2", nombre: "Taller 2", ubicacion: "Calle 2" },
      ],
    } as unknown as TenantContextValue;

    render(
      <TenantContext.Provider value={multiTallerContext}>
        <CardRightInfo price="$10.000" date="28/10/2026" taller="Taller 2" />
      </TenantContext.Provider>
    );

    expect(screen.getByTestId("card-right-info-taller")).toBeInTheDocument();
    expect(screen.getByText("Taller 2")).toBeInTheDocument();
  });
});

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Package, WalletCards } from "lucide-react";
import OperacionMeta from "./OperacionMeta";

describe("OperacionMeta", () => {
  const metaBadge = {
    icon: Package,
    labelDesktop: "2 productos",
    labelMobile: "2",
  };
  const accountOrWorkshop = {
    icon: WalletCards,
    labelDesktop: "Caja Chica",
    labelMobile: "Caja",
  };

  it("renderiza el importe formateado cuando isSinCargo es false o no provisto", () => {
    render(
      <OperacionMeta
        metaBadge={metaBadge}
        accountOrWorkshop={accountOrWorkshop}
        totalMonto={15000}
        isSinCargo={false}
      />
    );

    expect(screen.queryByTestId("chip-adquisicion-sin-cargo")).not.toBeInTheDocument();
    expect(screen.getAllByText("$15.000").length).toBeGreaterThan(0);
  });

  it("renderiza el chip 'Adquisición sin cargo' cuando isSinCargo es true", () => {
    render(
      <OperacionMeta
        metaBadge={metaBadge}
        accountOrWorkshop={accountOrWorkshop}
        totalMonto={0}
        isSinCargo={true}
      />
    );

    const chips = screen.getAllByTestId("chip-adquisicion-sin-cargo");
    expect(chips.length).toBeGreaterThan(0);
    expect(chips[0]).toHaveTextContent("Adquisición sin cargo");
    expect(screen.queryByText("$ 0,00")).not.toBeInTheDocument();
  });

  it("renderiza el nombre del cliente para operaciones de venta", () => {
    render(
      <OperacionMeta
        metaBadge={metaBadge}
        accountOrWorkshop={accountOrWorkshop}
        totalMonto={25000}
        tipo="VENTA"
        clienteNombre="Juan Pérez"
      />
    );

    expect(screen.getAllByText("Juan Pérez").length).toBeGreaterThan(0);
  });

  it("renderiza el nombre del proveedor para operaciones de compra", () => {
    render(
      <OperacionMeta
        metaBadge={metaBadge}
        accountOrWorkshop={accountOrWorkshop}
        totalMonto={40000}
        tipo="COMPRA"
        proveedorNombre="Distribuidora Warnes"
      />
    );

    expect(screen.getAllByText("Distribuidora Warnes").length).toBeGreaterThan(0);
  });

  it("no renderiza el nombre del proveedor para operaciones de gasto aunque se provea", () => {
    render(
      <OperacionMeta
        metaBadge={metaBadge}
        accountOrWorkshop={accountOrWorkshop}
        totalMonto={40000}
        tipo="GASTO"
        proveedorNombre="Distribuidora Warnes"
      />
    );

    expect(screen.queryByText("Distribuidora Warnes")).not.toBeInTheDocument();
  });
});

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

  it("renderiza la etiqueta de metadatos y cuenta correctamente", () => {
    render(
      <OperacionMeta
        metaBadge={metaBadge}
        accountOrWorkshop={accountOrWorkshop}
      />
    );

    expect(screen.getAllByText("2 productos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Caja Chica").length).toBeGreaterThan(0);
  });

  it("renderiza el nombre del cliente para operaciones de venta", () => {
    render(
      <OperacionMeta
        metaBadge={metaBadge}
        accountOrWorkshop={accountOrWorkshop}
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
        tipo="GASTO"
        proveedorNombre="Distribuidora Warnes"
      />
    );

    expect(screen.queryByText("Distribuidora Warnes")).not.toBeInTheDocument();
  });
});

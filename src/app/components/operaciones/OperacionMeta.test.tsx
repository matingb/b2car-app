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
});

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ClienteTabsNav from "./ClienteTabsNav";

describe("ClienteTabsNav", () => {
  it("renderiza todas las pestañas y destaca la activa", () => {
    const onChangeTab = vi.fn();
    render(
      <ClienteTabsNav
        activeTab="vehiculos"
        onChangeTab={onChangeTab}
        vehiculosCount={4}
        arreglosCount={12}
      />
    );

    expect(screen.getByText("Vehículos")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Trabajos y Arreglos")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Cuenta Corriente")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cuenta Corriente"));
    expect(onChangeTab).toHaveBeenCalledWith("cuenta_corriente");
  });
});

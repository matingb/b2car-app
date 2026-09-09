import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ClientesFiltersModal, { DEFAULT_CLIENTES_FILTERS } from "./ClientesFiltersModal";

describe("ClientesFiltersModal", () => {
  it("no renderiza nada cuando open es false", () => {
    const { container } = render(
      <ClientesFiltersModal
        open={false}
        initial={DEFAULT_CLIENTES_FILTERS}
        onClose={vi.fn()}
        onApply={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza campos de tipo de cliente y estado de saldo cuando open es true", () => {
    render(
      <ClientesFiltersModal
        open={true}
        initial={DEFAULT_CLIENTES_FILTERS}
        onClose={vi.fn()}
        onApply={vi.fn()}
      />
    );

    expect(screen.getByText("Filtrar clientes")).toBeInTheDocument();
    expect(screen.getByTestId("clientes-filter-tipo")).toBeInTheDocument();
    expect(screen.getByTestId("clientes-filter-saldo")).toBeInTheDocument();
  });

  it("permite cambiar los valores y aplicar los filtros", () => {
    const handleApply = vi.fn();
    const handleClose = vi.fn();

    render(
      <ClientesFiltersModal
        open={true}
        initial={DEFAULT_CLIENTES_FILTERS}
        onClose={handleClose}
        onApply={handleApply}
      />
    );

    fireEvent.change(screen.getByTestId("clientes-filter-tipo"), {
      target: { value: "empresa" },
    });
    fireEvent.change(screen.getByTestId("clientes-filter-saldo"), {
      target: { value: "PENDIENTE" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(handleApply).toHaveBeenCalledWith({
      tipoCliente: "empresa",
      saldo: "PENDIENTE",
    });
    expect(handleClose).toHaveBeenCalled();
  });

  it("permite limpiar filtros reseteando a los valores por defecto", () => {
    const handleApply = vi.fn();
    const handleClose = vi.fn();

    render(
      <ClientesFiltersModal
        open={true}
        initial={{ tipoCliente: "particular", saldo: "AL_DIA" }}
        onClose={handleClose}
        onApply={handleApply}
      />
    );

    fireEvent.click(screen.getByTestId("clientes-filter-modal-clear"));

    expect(handleApply).toHaveBeenCalledWith(DEFAULT_CLIENTES_FILTERS);
    expect(handleClose).toHaveBeenCalled();
  });
});

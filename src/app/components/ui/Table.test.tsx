import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Table from "./Table";

describe("Table component", () => {
  it("renderiza correctamente encabezados y celdas con datos", () => {
    render(
      <Table data-testid="test-table">
        <Table.Header>
          <Table.Head>Nombre</Table.Head>
          <Table.Head align="right">Monto</Table.Head>
          <Table.Head align="center">Estado</Table.Head>
        </Table.Header>
        <Table.Body>
          <Table.Row data-testid="row-1">
            <Table.Cell>Item 1</Table.Cell>
            <Table.Cell align="right">$100</Table.Cell>
            <Table.Cell align="center">Activo</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>
    );

    expect(screen.getByTestId("test-table")).toBeInTheDocument();
    expect(screen.getByText("Nombre")).toBeInTheDocument();
    expect(screen.getByText("Monto")).toBeInTheDocument();
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("$100")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
  });

  it("permite hacer click en una fila y ejecuta onClick", () => {
    const handleClick = vi.fn();
    render(
      <Table>
        <Table.Body>
          <Table.Row onClick={handleClick} data-testid="clickable-row">
            <Table.Cell>Click me</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>
    );

    fireEvent.click(screen.getByTestId("clickable-row"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("soporta nowrap=false en celdas", () => {
    render(
      <Table>
        <Table.Body>
          <Table.Row>
            <Table.Cell nowrap={false} data-testid="wrap-cell">
              Texto largo que puede dividirse en múltiples líneas
            </Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>
    );

    expect(screen.getByTestId("wrap-cell")).toHaveTextContent("Texto largo");
  });

  it("aplica atributos color y weight en Table.Cell y Table.Head", () => {
    render(
      <Table>
        <Table.Header>
          <Table.Head color="#ff0000" weight={600} data-testid="head-custom">
            Header Custom
          </Table.Head>
        </Table.Header>
        <Table.Body>
          <Table.Row>
            <Table.Cell color="#00ff00" weight={700} data-testid="cell-custom">
              Cell Custom
            </Table.Cell>
            <Table.Cell fontWeight={500} data-testid="cell-weight-alias">
              Cell Alias
            </Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>
    );

    const head = screen.getByTestId("head-custom");
    expect(head).toHaveStyle({ color: "#ff0000", fontWeight: "600" });

    const cell = screen.getByTestId("cell-custom");
    expect(cell).toHaveStyle({ color: "#00ff00", fontWeight: "700" });

    const cellAlias = screen.getByTestId("cell-weight-alias");
    expect(cellAlias).toHaveStyle({ fontWeight: "500" });
  });
});


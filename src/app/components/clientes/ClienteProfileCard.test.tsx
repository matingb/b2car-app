import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ClienteProfileCard from "./ClienteProfileCard";
import { TipoCliente } from "@/model/types";

describe("ClienteProfileCard", () => {
  const defaultProps = {
    tipo: TipoCliente.EMPRESA,
    nombre: "Logística Central S.A.",
    direccion: "Av. Corrientes 1234, CABA",
    email: "contacto@logistica.com",
    telefono: "1145678900",
    codigo_pais: "54",
    cuit: "30-71234567-8",
    resumenFinanciero: {
      saldo_cuenta: 430000,
      saldo_a_facturar: 180000,
      total_historico_trabajos: 500000,
      total_historico_cobrado: 70000,
      cantidad_arreglos_pendientes_pago: 2,
      cantidad_arreglos_pendientes_factura: 1,
    },
    loadingFinanzas: false,
    onEditCliente: vi.fn(),
    representantes: [
      {
        id: "rep-1",
        empresa_id: "emp-1",
        nombre: "Carlos Gómez",
        apellido: "",
        telefono: "1198765432",
        email: "carlos@logistica.com",
      },
    ],
    onAddRepresentante: vi.fn(),
    onDeleteRepresentante: vi.fn(),
  };

  it("renderiza correctamente las iniciales del avatar, nombre y dirección", () => {
    render(<ClienteProfileCard {...defaultProps} />);

    expect(screen.getByText("LC")).toBeInTheDocument();
    expect(screen.getByText("Logística Central S.A.")).toBeInTheDocument();
    expect(screen.getByText("Av. Corrientes 1234, CABA")).toBeInTheDocument();
  });

  it("renderiza el saldo deudor y el badge de deuda pendiente", () => {
    render(<ClienteProfileCard {...defaultProps} />);

    // Saldo formatted as $ 430.000 (ARS)
    expect(screen.getByText(/430\.000/)).toBeInTheDocument();
    expect(screen.getByText("Deuda pendiente")).toBeInTheDocument();
  });

  it("renderiza 'Al día' cuando el saldo deudor es 0 y oculta el badge de facturar si saldo_a_facturar es 0", () => {
    render(
      <ClienteProfileCard
        {...defaultProps}
        resumenFinanciero={{
          saldo_cuenta: 0,
          saldo_a_facturar: 0,
          total_historico_trabajos: 200000,
          total_historico_cobrado: 200000,
          cantidad_arreglos_pendientes_pago: 0,
          cantidad_arreglos_pendientes_factura: 0,
        }}
      />
    );

    expect(screen.getByText("Al día")).toBeInTheDocument();
    expect(screen.queryByText("Deuda pendiente")).not.toBeInTheDocument();
    expect(screen.queryByText(/Faltan facturar/)).not.toBeInTheDocument();
  });

  it("muestra saldo a favor en azul cuando los cobros superan los trabajos", () => {
    render(
      <ClienteProfileCard
        {...defaultProps}
        resumenFinanciero={{
          saldo_cuenta: -75000,
          saldo_a_facturar: 0,
          total_historico_trabajos: 200000,
          total_historico_cobrado: 275000,
          cantidad_arreglos_pendientes_pago: 0,
          cantidad_arreglos_pendientes_factura: 0,
        }}
      />
    );

    expect(screen.getByText("Saldo a favor")).toBeInTheDocument();
    expect(screen.getByText(/75\.000/)).toBeInTheDocument();
    expect(screen.queryByText("Al día")).not.toBeInTheDocument();
  });

  it("renderiza los datos de contacto y permite llamar a onEditCliente", () => {
    render(<ClienteProfileCard {...defaultProps} />);

    expect(screen.getByText("contacto@logistica.com")).toBeInTheDocument();
    expect(screen.getByText("30-71234567-8")).toBeInTheDocument();

    const editBtn = screen.getByRole("button", { name: /Editar/i });
    fireEvent.click(editBtn);
    expect(defaultProps.onEditCliente).toHaveBeenCalled();
  });

  it("renderiza la lista de representantes para empresas y permite interactuar", () => {
    render(<ClienteProfileCard {...defaultProps} />);

    expect(screen.getByText("REPRESENTANTES")).toBeInTheDocument();
    expect(screen.getByText("Carlos Gómez")).toBeInTheDocument();

    const addBtn = screen.getByRole("button", { name: /Añadir/i });
    fireEvent.click(addBtn);
    expect(defaultProps.onAddRepresentante).toHaveBeenCalled();

    const deleteBtn = screen.getByTitle("Eliminar representante");
    fireEvent.click(deleteBtn);
    expect(defaultProps.onDeleteRepresentante).toHaveBeenCalledWith("rep-1");
  });

  it("renderiza adecuadamente para un cliente particular", () => {
    render(
      <ClienteProfileCard
        tipo={TipoCliente.PARTICULAR}
        nombre="Juan Pérez"
        numero_documento="35123456"
        resumenFinanciero={null}
        loadingFinanzas={false}
        onEditCliente={vi.fn()}
      />
    );

    expect(screen.getByText("JP")).toBeInTheDocument();
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByText("35123456")).toBeInTheDocument();
    expect(screen.queryByText("ESTADO DEL CLIENTE")).not.toBeInTheDocument();
    expect(screen.queryByText("REPRESENTANTES")).not.toBeInTheDocument();
  });
});

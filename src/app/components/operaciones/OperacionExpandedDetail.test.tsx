import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OperacionExpandedDetail from "./OperacionExpandedDetail";
import type { Operacion } from "@/model/types";

describe("OperacionExpandedDetail", () => {
  it("muestra observaciones para operaciones de tipo VENTA cuando tiene observación", () => {
    const operacion: Operacion = {
      id: "op-venta-1",
      tipo: "VENTA",
      taller_id: "taller-1",
      fecha: "2026-10-07T12:00:00Z",
      created_at: "2026-10-07T12:00:00Z",
      observaciones: "Entrega pactada por la tarde",
      lineas: [
        {
          id: "linea-1",
          operacion_id: "op-venta-1",
          stock_id: "stock-1",
          cantidad: 2,
          monto_unitario: 1000,
          delta_cantidad: -2,
          created_at: "2026-10-07T12:00:00Z",
          nombre: "Bujía Bosch",
        },
      ],
    };

    render(
      <OperacionExpandedDetail
        operacion={operacion}
        stocksById={{}}
        isMovimientoFinanciero={false}
      />
    );

    const section = screen.getByTestId("operacion-expanded-observaciones");
    expect(section).toBeInTheDocument();
    expect(section).toHaveTextContent("Observaciones");
    expect(section).toHaveTextContent("Entrega pactada por la tarde");
  });

  it("muestra observaciones para operaciones de tipo COMPRA cuando tiene observación", () => {
    const operacion: Operacion = {
      id: "op-compra-1",
      tipo: "COMPRA",
      taller_id: "taller-1",
      fecha: "2026-10-07T12:00:00Z",
      created_at: "2026-10-07T12:00:00Z",
      observaciones: "Factura recibida en papel",
      lineas: [
        {
          id: "linea-1",
          operacion_id: "op-compra-1",
          stock_id: "stock-1",
          cantidad: 5,
          monto_unitario: 500,
          delta_cantidad: 5,
          created_at: "2026-10-07T12:00:00Z",
          nombre: "Filtro de aire",
        },
      ],
    };

    render(
      <OperacionExpandedDetail
        operacion={operacion}
        stocksById={{}}
        isMovimientoFinanciero={false}
      />
    );

    const section = screen.getByTestId("operacion-expanded-observaciones");
    expect(section).toBeInTheDocument();
    expect(section).toHaveTextContent("Factura recibida en papel");
  });

  it("muestra observaciones para operaciones de tipo GASTO cuando tiene observación", () => {
    const operacion: Operacion = {
      id: "op-gasto-1",
      tipo: "GASTO",
      taller_id: null,
      fecha: "2026-10-07T12:00:00Z",
      created_at: "2026-10-07T12:00:00Z",
      lineas: [],
      descripcion: "Pago de luz",
      categoria_gasto: "SERVICIOS",
      cuenta_financiera_nombre: "Caja Chica",
      observaciones: "Vencimiento abonado con recargo",
    };

    render(
      <OperacionExpandedDetail
        operacion={operacion}
        stocksById={{}}
        isMovimientoFinanciero={true}
      />
    );

    const section = screen.getByTestId("operacion-expanded-observaciones");
    expect(section).toBeInTheDocument();
    expect(section).toHaveTextContent("Vencimiento abonado con recargo");
  });

  it("NO muestra observaciones para operaciones de tipo ASIGNACION_ARREGLO aunque tenga observaciones", () => {
    const operacion: Operacion = {
      id: "op-asig-1",
      tipo: "ASIGNACION_ARREGLO",
      taller_id: "taller-1",
      fecha: "2026-10-07T12:00:00Z",
      created_at: "2026-10-07T12:00:00Z",
      observaciones: "Observación interna de asignación",
      lineas: [
        {
          id: "linea-1",
          operacion_id: "op-asig-1",
          stock_id: "stock-1",
          cantidad: 1,
          monto_unitario: 500,
          delta_cantidad: -1,
          created_at: "2026-10-07T12:00:00Z",
          nombre: "Aceite",
        },
      ],
    };

    render(
      <OperacionExpandedDetail
        operacion={operacion}
        stocksById={{}}
        isMovimientoFinanciero={false}
      />
    );

    expect(screen.queryByTestId("operacion-expanded-observaciones")).not.toBeInTheDocument();
    expect(screen.queryByText("Observaciones")).not.toBeInTheDocument();
  });

  it("NO muestra observaciones si el campo está vacío o solo contiene espacios", () => {
    const operacion: Operacion = {
      id: "op-venta-vacia",
      tipo: "VENTA",
      taller_id: "taller-1",
      fecha: "2026-10-07T12:00:00Z",
      created_at: "2026-10-07T12:00:00Z",
      observaciones: "   ",
      lineas: [],
    };

    render(
      <OperacionExpandedDetail
        operacion={operacion}
        stocksById={{}}
        isMovimientoFinanciero={false}
      />
    );

    expect(screen.queryByTestId("operacion-expanded-observaciones")).not.toBeInTheDocument();
  });

  it("muestra productos y cumplimiento de entrega sin banner desglosado ni botones de acción", () => {
    const operacion: Operacion = {
      id: "op-venta-diferida",
      tipo: "VENTA",
      taller_id: "taller-1",
      fecha: "2026-10-07T12:00:00Z",
      created_at: "2026-10-07T12:00:00Z",
      monto_total: 10000,
      total_pagado: 0,
      saldo_pendiente: 10000,
      esta_pago: false,
      estado_pago: "PENDIENTE",
      estado_stock: "PENDIENTE",
      lineas: [
        {
          id: "linea-1",
          operacion_id: "op-venta-diferida",
          stock_id: "stock-1",
          cantidad: 5,
          cantidad_cumplida: 0,
          monto_unitario: 2000,
          delta_cantidad: 0,
          created_at: "2026-10-07T12:00:00Z",
          nombre: "Bujía Bosch",
        },
      ],
    };

    render(
      <OperacionExpandedDetail
        operacion={operacion}
        stocksById={{}}
        isMovimientoFinanciero={false}
      />
    );

    expect(screen.queryByTestId("operacion-registrar-pago-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("operacion-confirmar-stock-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("operacion-expanded-cliente")).not.toBeInTheDocument();
    expect(screen.queryByTestId("operacion-expanded-proveedor")).not.toBeInTheDocument();
    expect(screen.getByText("Bujía Bosch")).toBeInTheDocument();
    expect(screen.getByText(/0 de 5 unidades entregadas/i)).toBeInTheDocument();
  });

  it("NO muestra leyenda de cumplimiento parcial si la operacion esta en estado ENTREGADO", () => {
    const operacion: Operacion = {
      id: "op-compra-entregada",
      tipo: "COMPRA",
      taller_id: "taller-1",
      fecha: "2026-10-07T12:00:00Z",
      created_at: "2026-10-07T12:00:00Z",
      estado_stock: "ENTREGADO",
      lineas: [
        {
          id: "linea-1",
          operacion_id: "op-compra-entregada",
          stock_id: "stock-1",
          cantidad: 20,
          cantidad_cumplida: 0,
          monto_unitario: 3200,
          delta_cantidad: 20,
          created_at: "2026-10-07T12:00:00Z",
          nombre: "Bujía Iridium",
        },
      ],
    };

    render(
      <OperacionExpandedDetail
        operacion={operacion}
        stocksById={{}}
        isMovimientoFinanciero={false}
      />
    );

    expect(screen.getByText("Bujía Iridium")).toBeInTheDocument();
    expect(screen.queryByText(/unidades recibidas/i)).not.toBeInTheDocument();
  });
});

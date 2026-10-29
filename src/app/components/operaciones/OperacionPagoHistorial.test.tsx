import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OperacionPagoHistorial from "@/app/components/operaciones/OperacionPagoHistorial";
import type { OperacionPago } from "@/model/types";

describe("OperacionPagoHistorial", () => {
  const mockPagos: OperacionPago[] = [
    {
      id: "pago-1",
      operacion_id: "op-1",
      cuenta_financiera_id: "acc-1",
      cuenta_financiera_nombre: "Caja Efectivo",
      monto: 40000,
      fecha: "2026-08-20",
      descripcion: "Seña inicial",
      created_at: "2026-08-20T10:00:00Z",
    },
    {
      id: "pago-2",
      operacion_id: "op-1",
      cuenta_financiera_id: "acc-2",
      cuenta_financiera_nombre: "Banco Galicia",
      monto: 20000,
      fecha: "2026-08-22",
      descripcion: "Transferencia resto",
      created_at: "2026-08-22T14:30:00Z",
    },
  ];

  it("no renderiza nada cuando la lista de pagos está vacía", () => {
    const { container } = render(
      <OperacionPagoHistorial pagos={[]} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza por defecto únicamente el título con la cantidad y el monto total acumulado para ventas", () => {
    render(
      <OperacionPagoHistorial
        pagos={mockPagos}
        tipo="VENTA"
        onAnularPago={vi.fn()}
      />
    );

    // Título con cantidad (2) y texto de cobros
    expect(
      screen.getByText(/Cobros registrados previamente \(2\)/i)
    ).toBeInTheDocument();

    // Monto total sumado (40.000 + 20.000 = $60.000)
    expect(screen.getByText("$60.000")).toBeInTheDocument();

    // Por defecto el contenido del listado no está visible
    expect(screen.queryByTestId("operacion-pagos-historial-list")).not.toBeInTheDocument();
    expect(screen.queryByText("Caja Efectivo")).not.toBeInTheDocument();
  });

  it("renderiza texto de pagos registrados previamente cuando es una compra", () => {
    render(
      <OperacionPagoHistorial
        pagos={mockPagos}
        tipo="COMPRA"
        onAnularPago={vi.fn()}
      />
    );

    expect(
      screen.getByText(/Pagos registrados previamente \(2\)/i)
    ).toBeInTheDocument();
  });

  it("despliega el historial al hacer clic en el encabezado y muestra los detalles de cada pago", async () => {
    const user = userEvent.setup();

    render(
      <OperacionPagoHistorial
        pagos={mockPagos}
        onAnularPago={vi.fn()}
      />
    );

    const toggleButton = screen.getByTestId("operacion-pagos-historial-toggle");
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");

    await user.click(toggleButton);

    expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("operacion-pagos-historial-list")).toBeInTheDocument();

    expect(screen.getByText("$40.000")).toBeInTheDocument();
    expect(screen.getByText("$20.000")).toBeInTheDocument();
    expect(screen.getByText(/Caja Efectivo/i)).toBeInTheDocument();
    expect(screen.getByText(/• Seña inicial/i)).toBeInTheDocument();
    expect(screen.getByText(/Banco Galicia/i)).toBeInTheDocument();
    expect(screen.getByText(/• Transferencia resto/i)).toBeInTheDocument();

    // Volver a cerrar
    await user.click(toggleButton);
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("operacion-pagos-historial-list")).not.toBeInTheDocument();
  });

  it("ejecuta onAnularPago al presionar el botón de anular un pago", async () => {
    const user = userEvent.setup();
    const handleAnular = vi.fn();

    render(
      <OperacionPagoHistorial
        pagos={mockPagos}
        tipo="VENTA"
        onAnularPago={handleAnular}
      />
    );

    await user.click(screen.getByTestId("operacion-pagos-historial-toggle"));

    const btnAnularPago1 = screen.getByTestId("btn-anular-pago-pago-1");
    await user.click(btnAnularPago1);

    expect(handleAnular).toHaveBeenCalledTimes(1);
    expect(handleAnular).toHaveBeenCalledWith("pago-1", 40000);
  });

  it("deshabilita el botón de anular para el pago que se está anulando actualmente", async () => {
    const user = userEvent.setup();

    render(
      <OperacionPagoHistorial
        pagos={mockPagos}
        anulandoPagoId="pago-2"
        onAnularPago={vi.fn()}
      />
    );

    await user.click(screen.getByTestId("operacion-pagos-historial-toggle"));

    const btn1 = screen.getByTestId("btn-anular-pago-pago-1");
    const btn2 = screen.getByTestId("btn-anular-pago-pago-2");

    expect(btn1).not.toBeDisabled();
    expect(btn2).toBeDisabled();
  });
});

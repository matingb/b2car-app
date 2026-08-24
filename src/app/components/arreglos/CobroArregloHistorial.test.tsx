import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CobroArregloHistorial from "@/app/components/arreglos/CobroArregloHistorial";
import type { CobroArregloItem } from "@/model/types";

describe("CobroArregloHistorial", () => {
  const mockCobros: CobroArregloItem[] = [
    {
      id: "cobro-1",
      operacion_id: "op-1",
      cuenta_id: "acc-1",
      cuenta_nombre: "Caja Efectivo",
      importe: 40000,
      fecha: "2026-08-20",
      descripcion: "Seña inicial",
      created_at: "2026-08-20T10:00:00Z",
    },
    {
      id: "cobro-2",
      operacion_id: "op-2",
      cuenta_id: "acc-2",
      cuenta_nombre: "Banco Galicia",
      importe: 20000,
      fecha: "2026-08-22",
      descripcion: "Transferencia resto",
      created_at: "2026-08-22T14:30:00Z",
    },
  ];

  it("no renderiza nada cuando la lista de cobros está vacía", () => {
    const { container } = render(
      <CobroArregloHistorial
        cobros={[]}
        onAnularCobro={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza por defecto únicamente el título con la cantidad y el monto total acumulado", () => {
    render(
      <CobroArregloHistorial
        cobros={mockCobros}
        onAnularCobro={vi.fn()}
      />
    );

    // Título con cantidad (2)
    expect(
      screen.getByText(/Cobros registrados previamente \(2\)/i)
    ).toBeInTheDocument();

    // Monto total sumado (40.000 + 20.000 = $60.000)
    expect(screen.getByText("$60.000")).toBeInTheDocument();

    // Por defecto el contenido del listado no está visible
    expect(screen.queryByTestId("cobros-historial-list")).not.toBeInTheDocument();
    expect(screen.queryByText("Caja Efectivo")).not.toBeInTheDocument();
    expect(screen.queryByText("Banco Galicia")).not.toBeInTheDocument();
  });

  it("despliega el historial al hacer clic en el encabezado y muestra los detalles de cada cobro", async () => {
    const user = userEvent.setup();

    render(
      <CobroArregloHistorial
        cobros={mockCobros}
        onAnularCobro={vi.fn()}
      />
    );

    const toggleButton = screen.getByTestId("cobros-historial-toggle");
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");

    // Click para abrir
    await user.click(toggleButton);

    expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("cobros-historial-list")).toBeInTheDocument();

    // Verificamos los montos individuales
    expect(screen.getByText("$40.000")).toBeInTheDocument();
    expect(screen.getByText("$20.000")).toBeInTheDocument();

    // Verificamos las cuentas y descripciones
    expect(screen.getByText(/Caja Efectivo/i)).toBeInTheDocument();
    expect(screen.getByText(/• Seña inicial/i)).toBeInTheDocument();
    expect(screen.getByText(/Banco Galicia/i)).toBeInTheDocument();
    expect(screen.getByText(/• Transferencia resto/i)).toBeInTheDocument();

    // Click para volver a cerrar
    await user.click(toggleButton);
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("cobros-historial-list")).not.toBeInTheDocument();
  });

  it("ejecuta onAnularCobro al presionar el botón de anular un cobro específico", async () => {
    const user = userEvent.setup();
    const handleAnular = vi.fn();

    render(
      <CobroArregloHistorial
        cobros={mockCobros}
        onAnularCobro={handleAnular}
      />
    );

    // Abrir desplegable
    await user.click(screen.getByTestId("cobros-historial-toggle"));

    const btnAnularOp1 = screen.getByTestId("btn-anular-cobro-op-1");
    await user.click(btnAnularOp1);

    expect(handleAnular).toHaveBeenCalledTimes(1);
    expect(handleAnular).toHaveBeenCalledWith("op-1", 40000);
  });

  it("deshabilita el botón de anular para el cobro que se está anulando actualmente", async () => {
    const user = userEvent.setup();

    render(
      <CobroArregloHistorial
        cobros={mockCobros}
        anulandoOpId="op-2"
        onAnularCobro={vi.fn()}
      />
    );

    // Abrir desplegable
    await user.click(screen.getByTestId("cobros-historial-toggle"));

    const btnOp1 = screen.getByTestId("btn-anular-cobro-op-1");
    const btnOp2 = screen.getByTestId("btn-anular-cobro-op-2");

    expect(btnOp1).not.toBeDisabled();
    expect(btnOp2).toBeDisabled();
  });
});

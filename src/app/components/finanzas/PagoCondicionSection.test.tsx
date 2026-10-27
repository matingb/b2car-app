import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PagoCondicionSection from "./PagoCondicionSection";
import type { PagoDraftItem } from "@/app/components/arreglos/RegistrarPagoSection";

describe("PagoCondicionSection", () => {
  const mockCuentaFavorita = {
    id: "acc-fav",
    nombre: "Banco Galicia",
  };

  const mockPagos: PagoDraftItem[] = [
    {
      id: "p1",
      cuentaId: "acc-fav",
      monto: "52000",
      fecha: "2026-10-26",
      descripcion: "",
    },
  ];

  it("renderiza la vista simple cuando hay cuenta favorita, showAdvanced es false y hay pagos", () => {
    render(
      <PagoCondicionSection
        tipo="VENTA"
        totalOperacion={52000}
        cuentaFavorita={mockCuentaFavorita}
        pagos={mockPagos}
        onAddPago={vi.fn()}
        onRemovePago={vi.fn()}
        onUpdatePago={vi.fn()}
        showAdvanced={false}
        onToggleAdvanced={vi.fn()}
      />
    );

    expect(screen.getByTestId("cobro-simple")).toBeInTheDocument();
    expect(screen.getByText("Banco Galicia")).toBeInTheDocument();
    expect(screen.getByText("Importe: $52.000")).toBeInTheDocument();
    expect(screen.queryByTestId("pago-no-pagar-checkbox")).not.toBeInTheDocument();
  });

  it("renderiza la vista avanzada cuando showAdvanced es true", () => {
    render(
      <PagoCondicionSection
        tipo="COMPRA"
        totalOperacion={52000}
        cuentaFavorita={mockCuentaFavorita}
        pagos={mockPagos}
        onAddPago={vi.fn()}
        onRemovePago={vi.fn()}
        onUpdatePago={vi.fn()}
        showAdvanced={true}
        onToggleAdvanced={vi.fn()}
      />
    );

    expect(screen.queryByTestId("cobro-simple")).not.toBeInTheDocument();
    expect(screen.getByTestId("pago-card-0")).toBeInTheDocument();
    expect(screen.queryByTestId("pago-no-pagar-checkbox")).not.toBeInTheDocument();
  });

  it("permite alternar entre vista simple y avanzada mediante el toggle", async () => {
    const user = userEvent.setup();
    const handleToggle = vi.fn();

    render(
      <PagoCondicionSection
        tipo="VENTA"
        totalOperacion={52000}
        cuentaFavorita={mockCuentaFavorita}
        pagos={mockPagos}
        onAddPago={vi.fn()}
        onRemovePago={vi.fn()}
        onUpdatePago={vi.fn()}
        showAdvanced={false}
        onToggleAdvanced={handleToggle}
      />
    );

    const toggleBtn = screen.getByTestId("cobro-advanced-toggle");
    expect(toggleBtn).toHaveTextContent("Elegir otra cuenta, dividir o diferir el cobro");

    await user.click(toggleBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it("muestra el aviso de sin pago inmediato cuando se eliminan todas las cuentas", () => {
    render(
      <PagoCondicionSection
        tipo="COMPRA"
        totalOperacion={52000}
        cuentaFavorita={mockCuentaFavorita}
        contraparteNombre="Distribuidora Norte"
        pagos={[]}
        onAddPago={vi.fn()}
        onRemovePago={vi.fn()}
        onUpdatePago={vi.fn()}
        showAdvanced={false}
        onToggleAdvanced={vi.fn()}
      />
    );

    expect(screen.getByTestId("pago-empty-notice")).toBeInTheDocument();
    expect(screen.getByText("Operación a Cuenta Corriente")).toBeInTheDocument();
    expect(screen.getByText("Sin pago inmediato")).toBeInTheDocument();
    expect(
      screen.getByText(/se imputará como saldo pendiente en la cuenta corriente de/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Distribuidora Norte")).toBeInTheDocument();
    expect(screen.getByText("$ 52.000")).toBeInTheDocument();
    expect(screen.queryByTestId("cobro-advanced-toggle")).not.toBeInTheDocument();
  });

  it("permite restaurar la cuenta favorita o registrar un pago desde el aviso diferido", async () => {
    const user = userEvent.setup();
    const handleAdd = vi.fn();
    const handleRestore = vi.fn();

    render(
      <PagoCondicionSection
        tipo="VENTA"
        totalOperacion={52000}
        cuentaFavorita={mockCuentaFavorita}
        pagos={[]}
        onAddPago={handleAdd}
        onRemovePago={vi.fn()}
        onUpdatePago={vi.fn()}
        onRestoreFavorita={handleRestore}
        showAdvanced={false}
        onToggleAdvanced={vi.fn()}
      />
    );

    expect(screen.getByText("Sin cobro inmediato")).toBeInTheDocument();
    expect(screen.getByText("cliente")).toBeInTheDocument();

    const btnRestore = screen.getByTestId("btn-restore-favorita");
    expect(btnRestore).toHaveTextContent("Usar Banco Galicia");
    await user.click(btnRestore);
    expect(handleRestore).toHaveBeenCalledTimes(1);

    const btnAdd = screen.getByTestId("btn-add-account");
    expect(btnAdd).toHaveTextContent("Registrar un cobro");
    await user.click(btnAdd);
    expect(handleAdd).toHaveBeenCalledTimes(1);
  });
});

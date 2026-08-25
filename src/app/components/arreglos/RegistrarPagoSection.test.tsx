import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegistrarPagoSection, { type PagoDraftItem } from "@/app/components/arreglos/RegistrarPagoSection";

describe("RegistrarPagoSection", () => {
  const mockOptions = [
    { value: "acc-1", label: "Caja Efectivo" },
    { value: "acc-2", label: "Banco Galicia" },
  ];

  const mockPagos: PagoDraftItem[] = [
    {
      id: "pago-1",
      cuentaId: "acc-1",
      monto: "50000",
      fecha: "2026-08-24",
      descripcion: "Seña inicial",
    },
    {
      id: "pago-2",
      cuentaId: "",
      monto: "0",
      fecha: "2026-08-24",
      descripcion: "",
    },
  ];

  it("renderiza el encabezado con el título y el badge con el total ingresado", () => {
    render(
      <RegistrarPagoSection
        pagos={mockPagos}
        opcionesCuentas={mockOptions}
        onAddPago={vi.fn()}
        onRemovePago={vi.fn()}
        onUpdatePago={vi.fn()}
      />
    );

    expect(screen.getByText("Registrar Pago")).toBeInTheDocument();
    expect(screen.getByTestId("total-ingresado-badge")).toHaveTextContent("Total ingresado: $50.000");
  });

  it("renderiza las tarjetas de pago con sus respectivos campos", () => {
    render(
      <RegistrarPagoSection
        pagos={mockPagos}
        opcionesCuentas={mockOptions}
        onAddPago={vi.fn()}
        onRemovePago={vi.fn()}
        onUpdatePago={vi.fn()}
      />
    );

    expect(screen.getByTestId("pago-card-0")).toBeInTheDocument();
    expect(screen.getByTestId("pago-card-1")).toBeInTheDocument();

    const monto0 = screen.getByTestId("pago-monto-0") as HTMLInputElement;
    expect(monto0.value).toBe("50000");

    const fecha0 = screen.getByTestId("pago-fecha-0") as HTMLInputElement;
    expect(fecha0.value).toBe("2026-08-24");

    const desc0 = screen.getByTestId("pago-descripcion-0") as HTMLInputElement;
    expect(desc0.value).toBe("Seña inicial");
  });

  it("permite añadir otra cuenta al hacer clic en el botón inferior", async () => {
    const user = userEvent.setup();
    const handleAdd = vi.fn();

    render(
      <RegistrarPagoSection
        pagos={mockPagos}
        opcionesCuentas={mockOptions}
        onAddPago={handleAdd}
        onRemovePago={vi.fn()}
        onUpdatePago={vi.fn()}
      />
    );

    const btnAdd = screen.getByTestId("btn-add-account");
    await user.click(btnAdd);

    expect(handleAdd).toHaveBeenCalledTimes(1);
  });

  it("permite eliminar una fila cuando hay más de una", async () => {
    const user = userEvent.setup();
    const handleRemove = vi.fn();

    render(
      <RegistrarPagoSection
        pagos={mockPagos}
        opcionesCuentas={mockOptions}
        onAddPago={vi.fn()}
        onRemovePago={handleRemove}
        onUpdatePago={vi.fn()}
      />
    );

    const btnRemove0 = screen.getByTestId("pago-remove-0");
    expect(btnRemove0).not.toBeDisabled();

    await user.click(btnRemove0);
    expect(handleRemove).toHaveBeenCalledWith("pago-1");
  });

  it("deshabilita el botón de eliminar cuando sólo hay una fila", () => {
    render(
      <RegistrarPagoSection
        pagos={[mockPagos[0]]}
        opcionesCuentas={mockOptions}
        onAddPago={vi.fn()}
        onRemovePago={vi.fn()}
        onUpdatePago={vi.fn()}
      />
    );

    const btnRemove0 = screen.getByTestId("pago-remove-0");
    expect(btnRemove0).toBeDisabled();
  });

  it("llama a onUpdatePago al editar monto, fecha o descripción", async () => {
    const user = userEvent.setup();
    const handleUpdate = vi.fn();

    render(
      <RegistrarPagoSection
        pagos={mockPagos}
        opcionesCuentas={mockOptions}
        onAddPago={vi.fn()}
        onRemovePago={vi.fn()}
        onUpdatePago={handleUpdate}
      />
    );

    const descInput = screen.getByTestId("pago-descripcion-1");
    await user.type(descInput, "A");

    expect(handleUpdate).toHaveBeenCalledWith("pago-2", "descripcion", "A");
  });

  it("muestra el formulario inline de cuenta cuando cuentaId es __create_cuenta__", async () => {
    const user = userEvent.setup();
    const handleUpdate = vi.fn();
    const handleUpdateDraft = vi.fn();

    const optionsWithCreate = [
      {
        value: "__create_cuenta__",
        label: "+ Crear cuenta",
      },
      ...mockOptions,
    ];

    const pagosConCreacion: PagoDraftItem[] = [
      {
        id: "pago-1",
        cuentaId: "__create_cuenta__",
        monto: "50000",
        fecha: "2026-08-24",
        descripcion: "",
        cuentaDraft: {
          nombre: "Caja Chica",
          tipo: "EFECTIVO",
          saldoInicial: 0,
          activo: true,
        },
      },
    ];

    render(
      <RegistrarPagoSection
        pagos={pagosConCreacion}
        opcionesCuentas={optionsWithCreate}
        onAddPago={vi.fn()}
        onRemovePago={vi.fn()}
        onUpdatePago={handleUpdate}
        onUpdatePagoCuentaDraft={handleUpdateDraft}
      />
    );

    const inputNombre = screen.getByTestId("pago-cuenta-0-nombre");
    expect(inputNombre).toBeInTheDocument();
    expect((inputNombre as HTMLInputElement).value).toBe("Caja Chica");

    await user.type(inputNombre, "!");
    expect(handleUpdateDraft).toHaveBeenCalledWith("pago-1", expect.objectContaining({ nombre: "Caja Chica!" }));
  });
});

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LineaCardShell from "./LineaCardShell";
import { TenantTestProvider, mockHasPermission } from "@/tests/testUtils";
import { UserRole } from "@/lib/permissions";
import { Settings } from "lucide-react";

vi.mock("@/app/providers/CategoriasArregloProvider", () => ({
  useCategoriasArreglo: () => ({ categorias: [], isLoading: false }),
}));

vi.mock("@/app/providers/EmpleadosProvider", () => ({
  useEmpleados: () => ({ empleados: [], isLoading: false }),
}));

describe("LineaCardShell", () => {
  it("renderiza la vista no editable cuando isEditing es false", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <TenantTestProvider hasPermission={mockHasPermission(UserRole.Admin)}>
        <LineaCardShell
          kind="servicios"
          isEditing={false}
          title="Cambio de aceite"
          cantidad={1}
          unitario={15000}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </TenantTestProvider>
    );

    expect(screen.getByText("Cambio de aceite")).toBeInTheDocument();
    expect(screen.getByText("$15.000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /editar servicio/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /eliminar servicio/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /editar servicio/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("permite personalizar el icono en la vista no editable", () => {
    render(
      <TenantTestProvider hasPermission={mockHasPermission(UserRole.Admin)}>
        <LineaCardShell
          kind="repuestos"
          isEditing={false}
          title="Filtro de aire"
          cantidad={1}
          unitario={5000}
          icon={<Settings data-testid="custom-settings-icon" size={18} />}
        />
      </TenantTestProvider>
    );

    expect(screen.getByTestId("custom-settings-icon")).toBeInTheDocument();
  });

  it("no renderiza horasFacturadas ni horasTrabajadas cuando kind es repuestos", () => {
    render(
      <TenantTestProvider hasPermission={mockHasPermission(UserRole.Admin)}>
        <LineaCardShell
          kind="repuestos"
          isEditing={false}
          title="Batería 12V"
          cantidad={1}
          unitario={50000}
          horasFacturadas={2}
          horasTrabajadas={3}
        />
      </TenantTestProvider>
    );

    expect(screen.queryByLabelText(/ver detalle de horas/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fact:/i)).not.toBeInTheDocument();
  });

  it("renderiza el shell de edición cuando isEditing es true con total y botones de acción", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <TenantTestProvider hasPermission={mockHasPermission(UserRole.Admin)}>
        <LineaCardShell
          kind="servicios"
          isEditing={true}
          total={30000}
          onConfirm={onConfirm}
          onCancel={onCancel}
          confirmAriaLabel="guardar servicio"
          cancelAriaLabel="cancelar servicio"
          selectors={<span>Selectores de prueba</span>}
        >
          <input data-testid="test-input" placeholder="Input de prueba" />
        </LineaCardShell>
      </TenantTestProvider>
    );

    expect(screen.getByTestId("test-input")).toBeInTheDocument();
    expect(screen.getByText("Selectores de prueba")).toBeInTheDocument();
    expect(screen.getByText("$30.000")).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "guardar servicio" });
    const cancelBtn = screen.getByRole("button", { name: "cancelar servicio" });

    expect(confirmBtn).toBeInTheDocument();
    expect(cancelBtn).toBeInTheDocument();

    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("deshabilita los botones de acción y muestra spinner cuando submitting es true", () => {
    render(
      <TenantTestProvider hasPermission={mockHasPermission(UserRole.Admin)}>
        <LineaCardShell
          kind="servicios"
          isEditing={true}
          total={30000}
          submitting={true}
          confirmAriaLabel="guardar servicio"
          cancelAriaLabel="cancelar servicio"
        >
          <span>Campos</span>
        </LineaCardShell>
      </TenantTestProvider>
    );

    const confirmBtn = screen.getByRole("button", { name: "guardar servicio" });
    const cancelBtn = screen.getByRole("button", { name: "cancelar servicio" });

    expect(confirmBtn).toBeDisabled();
    expect(cancelBtn).toBeDisabled();
  });

  it("oculta el total en modo edición si el usuario no tiene permisos de ver precios", () => {
    render(
      <TenantTestProvider hasPermission={mockHasPermission(UserRole.Operativo)}>
        <LineaCardShell
          kind="servicios"
          isEditing={true}
          total={30000}
        >
          <span>Campos</span>
        </LineaCardShell>
      </TenantTestProvider>
    );

    expect(screen.queryByText("$30.000")).not.toBeInTheDocument();
  });
});

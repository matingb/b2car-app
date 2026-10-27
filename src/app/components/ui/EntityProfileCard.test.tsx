import React from "react";
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders as render, TenantTestProvider, mockHasPermission } from "@/tests/testUtils";
import EntityProfileCard, { getEntityInitials } from "./EntityProfileCard";
import { Permission, UserRole } from "@/lib/permissions";
import * as whatsappLib from "@/lib/whatsapp";

describe("EntityProfileCard", () => {
  it("calculates initials properly with getEntityInitials", () => {
    expect(getEntityInitials("B2CAR")).toBe("B2");
    expect(getEntityInitials("Logística Central S.A.")).toBe("LC");
    expect(getEntityInitials("Juan Pérez")).toBe("JP");
    expect(getEntityInitials("")).toBe("??");
    expect(getEntityInitials(null, "CL")).toBe("CL");
  });

  it("renders identity, address, and financial clean state", () => {
    const onEdit = vi.fn();

    render(
      <EntityProfileCard
        title="Transportes Norte"
        address="Ruta 9 Km 280"
        saldo={0}
        onEdit={onEdit}
        editTestId="entity-edit"
      />
    );

    expect(screen.getByText("TN")).toBeInTheDocument();
    expect(screen.getByText("Transportes Norte")).toBeInTheDocument();
    expect(screen.getByText("Ruta 9 Km 280")).toBeInTheDocument();
    expect(screen.getByText("Al día")).toBeInTheDocument();

    const editBtn = screen.getByTestId("entity-edit");
    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("renders debt state when saldo > 0", () => {
    render(
      <EntityProfileCard
        title="Gaston Rios"
        saldo={81500}
      />
    );

    expect(screen.getByText("Deuda pendiente")).toBeInTheDocument();
    expect(screen.getByText(/81\.500/)).toBeInTheDocument();
  });

  it("renders credit in favor when saldo < 0", () => {
    render(
      <EntityProfileCard
        title="Gaston Rios"
        saldo={-15000}
      />
    );

    expect(screen.getByText("Saldo a favor")).toBeInTheDocument();
    expect(screen.getByText(/15\.000/)).toBeInTheDocument();
  });

  it("hides financial section when permission is missing", () => {
    render(
      <TenantTestProvider hasPermission={mockHasPermission(UserRole.Operativo)}>
        <EntityProfileCard
          title="Cliente Test"
          saldo={50000}
          finanzasPermission={Permission.ClientesFinanzasView}
        />
      </TenantTestProvider>
    );

    expect(screen.queryByText(/50\.000/)).not.toBeInTheDocument();
    expect(screen.queryByText("Deuda pendiente")).not.toBeInTheDocument();
    expect(screen.getByText("Cliente Test")).toBeInTheDocument();
  });

  it("triggers whatsapp when whatsapp button is clicked", () => {
    const spy = vi.spyOn(whatsappLib, "openWhatsapp").mockImplementation(() => {});

    render(
      <EntityProfileCard
        title="Empresa SRL"
        whatsappPhone="+54911223344"
      />
    );

    const btn = screen.getByRole("button", { name: "WhatsApp" });
    fireEvent.click(btn);

    expect(spy).toHaveBeenCalledWith(
      "+54911223344",
      "Hola Empresa SRL, me comunico desde el taller."
    );

    spy.mockRestore();
  });
});

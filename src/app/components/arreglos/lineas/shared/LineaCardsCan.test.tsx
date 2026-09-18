import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ReadOnlyLineaCard from "./ReadOnlyLineaCard";
import EditableLineaCard from "./EditableLineaCard";
import { InlineEditorProvider } from "./InlineEditorContext";
import { TenantTestProvider, mockHasPermission } from "@/tests/testUtils";
import { UserRole } from "@/lib/permissions";

describe("Linea Cards authorization gating with <Can />", () => {
  describe("ReadOnlyLineaCard", () => {
    it("muestra precio unitario y total para un usuario admin", () => {
      render(
        <TenantTestProvider
          hasPermission={mockHasPermission(UserRole.Admin)}
        >
          <ReadOnlyLineaCard
            kind="servicios"
            title="Cambio de aceite"
            cantidad={2}
            unitario={5000}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            canInteract={true}
          />
        </TenantTestProvider>
      );

      // Total is $10.000
      expect(screen.getByText("$10.000")).toBeInTheDocument();
      // Unit is displayed in qtyXUnit "2 x $5.000"
      expect(screen.getByText("2 x $5.000")).toBeInTheDocument();
    });

    it("oculta precio unitario y total para un usuario operativo a través del fallback de Can", () => {
      render(
        <TenantTestProvider
          hasPermission={mockHasPermission(UserRole.Operativo)}
        >
          <ReadOnlyLineaCard
            kind="servicios"
            title="Cambio de aceite"
            cantidad={2}
            unitario={5000}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            canInteract={true}
          />
        </TenantTestProvider>
      );

      // Total must NOT be in document
      expect(screen.queryByText("$10.000")).not.toBeInTheDocument();
      // Fallback shows "Cantidad: 2"
      expect(screen.getByText("Cantidad: 2")).toBeInTheDocument();
      expect(screen.queryByText("2 x $5.000")).not.toBeInTheDocument();
    });
  });

  describe("EditableLineaCard", () => {
    it("muestra campo de precio y total para admin", () => {
      render(
        <TenantTestProvider
          hasPermission={mockHasPermission(UserRole.Admin)}
        >
          <InlineEditorProvider
            kind="servicios"
            mode="add"
            submitting={false}
            interactionEnabled={true}
            validation={{ ok: true }}
            onConfirm={vi.fn()}
            onCancel={vi.fn()}
          >
            <EditableLineaCard
              top={<span>Top Field</span>}
              draft={{ qty: "2", unit: "3000" }}
              onDraftChange={vi.fn()}
            />
          </InlineEditorProvider>
        </TenantTestProvider>
      );

      expect(screen.getByLabelText("Precio venta")).toBeInTheDocument();
      expect(screen.getByText("$6.000")).toBeInTheDocument();
    });

    it("oculta campo de precio y total para operativo a través de Can", () => {
      render(
        <TenantTestProvider
          hasPermission={mockHasPermission(UserRole.Operativo)}
        >
          <InlineEditorProvider
            kind="servicios"
            mode="add"
            submitting={false}
            interactionEnabled={true}
            validation={{ ok: true }}
            onConfirm={vi.fn()}
            onCancel={vi.fn()}
          >
            <EditableLineaCard
              top={<span>Top Field</span>}
              draft={{ qty: "2", unit: "3000" }}
              onDraftChange={vi.fn()}
            />
          </InlineEditorProvider>
        </TenantTestProvider>
      );

      expect(screen.queryByLabelText("Precio venta")).not.toBeInTheDocument();
      expect(screen.queryByText("$6.000")).not.toBeInTheDocument();
      // Cantidad input remains accessible
      expect(screen.getByLabelText("Cantidad")).toBeInTheDocument();
    });
  });
});

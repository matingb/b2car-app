import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FacturasToolbar from "./FacturasToolbar";

describe("FacturasToolbar", () => {
  it("filtra por tipo de comprobante mediante chips", async () => {
    const user = userEvent.setup();
    const onDocumentoTipoChange = vi.fn();

    render(
      <FacturasToolbar
        search=""
        onSearchChange={vi.fn()}
        onOpenFilters={vi.fn()}
        documentoTipo=""
        onDocumentoTipoChange={onDocumentoTipoChange}
        chips={[]}
        onRemoveChip={vi.fn()}
        onClearFilters={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Notas de crédito" }));

    expect(onDocumentoTipoChange).toHaveBeenCalledWith("NOTA_CREDITO");
  });
});

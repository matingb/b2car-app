import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FacturasFiltersModal, { type FacturasFilters } from "./FacturasFiltersModal";

const initial: FacturasFilters = {
  estado: "",
  ambiente: "",
  documentoTipo: "NOTA_CREDITO",
  desde: "",
  hasta: "",
};

describe("FacturasFiltersModal", () => {
  it("aplica el estado, ambiente y período, preservando el tipo elegido en los chips", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(<FacturasFiltersModal open initial={initial} onApply={onApply} onClose={onClose} />);

    await user.selectOptions(screen.getByTestId("facturas-filter-estado"), "AUTORIZADA");
    await user.selectOptions(screen.getByTestId("facturas-filter-ambiente"), "PRODUCCION");
    await user.type(screen.getByTestId("facturas-filter-desde"), "2026-09-01");
    await user.type(screen.getByTestId("facturas-filter-hasta"), "2026-09-30");
    await user.click(screen.getByTestId("modal-submit"));

    expect(onApply).toHaveBeenCalledWith({
      estado: "AUTORIZADA",
      ambiente: "PRODUCCION",
      documentoTipo: "NOTA_CREDITO",
      desde: "2026-09-01",
      hasta: "2026-09-30",
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RemitoTipoSelector from "./RemitoTipoSelector";
import type { RemitoPreflight } from "@/lib/remitos/types";

const tipos: RemitoPreflight["tipos"] = {
  R: { emitible: false, motivos: ["Falta configurar el CAI."], proximoNumeroVisible: "R 00001-00000005" },
  X: { emitible: true, motivos: [], proximoNumeroVisible: "X 00001-00000002" },
};

describe("RemitoTipoSelector", () => {
  it("no preselecciona ningún tipo y deja ambos habilitados aunque R no sea emitible", () => {
    const onChange = vi.fn();
    render(<RemitoTipoSelector value={null} onChange={onChange} tipos={tipos} />);

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    for (const radio of radios) {
      expect(radio).toHaveAttribute("aria-checked", "false");
      expect(radio).toBeEnabled();
    }
    expect(screen.getByRole("note")).toHaveTextContent("Sugerencia normativa (no obligatoria)");
    expect(screen.getByText("Próximo número: R 00001-00000005")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("informa la elección del usuario y no la cambia por su cuenta", () => {
    const onChange = vi.fn();
    const { rerender } = render(<RemitoTipoSelector value={null} onChange={onChange} tipos={tipos} />);

    fireEvent.click(screen.getByTestId("remito-tipo-R"));
    expect(onChange).toHaveBeenCalledWith("R");

    rerender(<RemitoTipoSelector value="R" onChange={onChange} tipos={tipos} />);
    expect(screen.getByTestId("remito-tipo-R")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("remito-tipo-X")).toHaveAttribute("aria-checked", "false");
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

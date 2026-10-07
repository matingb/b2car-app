import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RemitoListItem from "./RemitoListItem";
import type { RemitoResumen } from "@/lib/remitos/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const remito: RemitoResumen = {
  id: "remito-1",
  clase: "R",
  puntoEmision: 1,
  numero: 8,
  numeroVisible: "R 00001-00000008",
  fechaEmision: "2026-10-06",
  ambiente: "HOMOLOGACION",
  destinatarioNombre: "Juan Pérez",
  destinatarioDocumento: "DNI 30111222",
  factura: { id: "factura-1", label: "Factura C 00001-00000123" },
};

describe("RemitoListItem", () => {
  it("muestra tipo, número, fecha, destinatario y factura sin importes", () => {
    const { container } = render(<RemitoListItem remito={remito} />);

    expect(screen.getByText("Remito R")).toBeInTheDocument();
    expect(screen.getByText("R 00001-00000008")).toBeInTheDocument();
    expect(screen.getByText("06/10/2026")).toBeInTheDocument();
    expect(screen.getByText("Juan Pérez · DNI 30111222")).toBeInTheDocument();
    expect(screen.getByText("Factura C 00001-00000123")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\$|ARS|total/i);
  });

  it("indica cuando no tiene factura y navega al detalle", () => {
    render(<RemitoListItem remito={{ ...remito, factura: null }} />);
    expect(screen.getByText("Sin factura")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Remito R/ }));
    expect(push).toHaveBeenCalledWith("/remitos/remito-1");
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VehiculoCard from "./VehiculoCard";
import { createVehiculo } from "@/tests/factories";

describe("VehiculoCard", () => {
  it("Cuando se hace click en el card, se debe ejecutar onClick", async () => {
    const onClick = vi.fn();
    const vehiculo = createVehiculo({ nro_interno: "123" });

    render(<VehiculoCard vehiculo={vehiculo} onClick={onClick} />);

    await userEvent.click(screen.getByTestId("vehiculo-card"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});


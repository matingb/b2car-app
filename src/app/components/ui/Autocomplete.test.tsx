import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Autocomplete from "./Autocomplete";

describe("Autocomplete", () => {
  it("cuando isLoading=true y el dropdown está abierto, muestra el spinner", async () => {
    render(
      <Autocomplete
        options={[]}
        value=""
        onChange={() => {}}
        isLoading
      />
    );

    await userEvent.click(screen.getByRole("textbox"));
    expect(screen.getByLabelText("Cargando opciones")).toBeInTheDocument();
  });

  it("cuando filtra y no hay resultados, muestra estado vacío (no spinner)", async () => {
    render(
      <Autocomplete
        options={[
          { value: "1", label: "Toyota" },
          { value: "2", label: "Ford" },
        ]}
        value=""
        onChange={() => {}}
      />
    );

    await userEvent.click(screen.getByRole("textbox"));
    await userEvent.type(screen.getByRole("textbox"), "zzz");

    expect(screen.getByLabelText("Sin resultados")).toBeInTheDocument();
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
    expect(screen.queryByLabelText("Cargando opciones")).not.toBeInTheDocument();
  });

  it("cuando hay resultados filtrados, lista los elementos", async () => {
    render(
      <Autocomplete
        options={[
          { value: "1", label: "Toyota" },
          { value: "2", label: "Ford" },
        ]}
        value=""
        onChange={() => {}}
      />
    );

    await userEvent.click(screen.getByRole("textbox"));
    await userEvent.type(screen.getByRole("textbox"), "toy");

    expect(screen.getByText("Toyota")).toBeInTheDocument();
    expect(screen.queryByText("Ford")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Sin resultados")).not.toBeInTheDocument();
  });
});


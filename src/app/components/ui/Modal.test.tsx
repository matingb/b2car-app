import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Modal from "./Modal";

describe("Modal", () => {
  it("Debe renderizar el titulo y los textos de los botones recibidos por props", () => {
    render(
      <Modal
        open
        title="Mi Modal"
        submitText="Guardar"
        onClose={() => {}}
        onSubmit={() => {}}
      >
        <div>Contenido</div>
      </Modal>
    );

    expect(screen.getByTestId("modal-title")).toHaveTextContent("Mi Modal");
    expect(screen.getByTestId("modal-cancel")).toHaveTextContent("Cancelar");
    expect(screen.getByTestId("modal-submit")).toHaveTextContent("Guardar");
    expect(screen.getByText("Contenido")).toBeInTheDocument();
  });

  it("Cuando se hace click en el botón de cancelar, se debe llamar a la función onClose", async () => {
    const onClose = vi.fn();

    render(
      <Modal
        open
        title="Mi Modal"
        submitText="Guardar"
        onClose={onClose}
        onSubmit={vi.fn()}
      >
        <div />
      </Modal>
    );

    await userEvent.click(screen.getByTestId("modal-cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Cuando se hace click en el botón de guardar, se debe llamar a la función onSubmit y luego a la función onClose", async () => {
    const onSubmit = vi.fn(async () => {});

    render(
      <Modal
        open
        title="Mi Modal"
        submitText="Guardar"
        onClose={vi.fn()}
        onSubmit={onSubmit}
      >
        <div />
      </Modal>
    );

    await userEvent.click(screen.getByTestId("modal-submit"));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

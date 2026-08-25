import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CuentaFinancieraModal from "./CuentaFinancieraModal";

describe("CuentaFinancieraModal", () => {
  it("envia los cuatro datos permitidos para crear una cuenta", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(<CuentaFinancieraModal open onClose={onClose} onSave={onSave} showActivo={false} />);

    await user.type(screen.getByTestId("cuenta-financiera-nombre"), "Caja taller");
    await user.click(screen.getByTestId("cuenta-financiera-tipo"));
    await user.click(screen.getByRole("option", { name: "Efectivo" }));
    await user.clear(screen.getByTestId("cuenta-financiera-saldo-inicial"));
    await user.type(screen.getByTestId("cuenta-financiera-saldo-inicial"), "1500.50");
    await user.click(screen.getByTestId("modal-submit"));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        nombre: "Caja taller",
        tipo: "EFECTIVO",
        saldoInicial: 1500.5,
        activo: true,
      });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("permite inactivar una cuenta desde su formulario de edicion", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <CuentaFinancieraModal
        open
        title="Editar cuenta"
        initialValues={{
          nombre: "Banco",
          tipo: "CUENTA_BANCARIA",
          saldoInicial: 100,
          activo: true,
        }}
        onClose={vi.fn()}
        onSave={onSave}
        showSaldoInicial={false}
      />
    );

    await user.click(screen.getByTestId("cuenta-financiera-activa"));
    await user.click(screen.getByTestId("modal-submit"));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: "Banco",
          tipo: "CUENTA_BANCARIA",
          activo: false,
        })
      );
    });
  });

  it("permite cambiar el tipo de cuenta mediante el dropdown", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<CuentaFinancieraModal open onClose={vi.fn()} onSave={onSave} />);

    await user.type(screen.getByTestId("cuenta-financiera-nombre"), "Mercado Pago");
    await user.click(screen.getByTestId("cuenta-financiera-tipo"));
    await user.click(screen.getByRole("option", { name: "Billetera digital" }));
    await user.click(screen.getByTestId("modal-submit"));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: "Mercado Pago",
          tipo: "BILLETERA_DIGITAL",
        })
      );
    });
  });
});

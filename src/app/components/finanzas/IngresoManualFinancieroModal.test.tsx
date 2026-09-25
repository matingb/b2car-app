import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CuentaFinanciera, CrearIngresoManualInput } from "@/model/finanzas";
import { formatLocalDateLabel, toISODateTimeWithLocalCurrentTime } from "@/lib/fechas";
import IngresoManualFinancieroModal from "./IngresoManualFinancieroModal";

const activeAccount: CuentaFinanciera = {
  id: "11111111-1111-4111-8111-111111111111",
  nombre: "Caja principal",
  tipo: "EFECTIVO",
  saldoInicial: 0,
  saldoActual: 1000,
  activo: true,
  favorita: false,
  createdAt: "2026-08-25T00:00:00Z",
  updatedAt: "2026-08-25T00:00:00Z",
};

const inactiveAccount: CuentaFinanciera = {
  ...activeAccount,
  id: "22222222-2222-4222-8222-222222222222",
  nombre: "Caja inactiva",
  activo: false,
};

describe("IngresoManualFinancieroModal", () => {
  it("preselecciona una cuenta activa, oculta las inactivas y registra campos válidos", async () => {
    const onCreate = vi.fn(async (input: CrearIngresoManualInput) => {
      expect(input).toBeDefined();
    });
    const onClose = vi.fn();

    render(
      <IngresoManualFinancieroModal
        open
        cuentas={[activeAccount, inactiveAccount]}
        cuentaId={activeAccount.id}
        onClose={onClose}
        onCreate={onCreate}
      />
    );

    const accountSelector = await screen.findByTestId("ingreso-manual-cuenta");
    expect(accountSelector).toHaveTextContent("Caja principal");
    fireEvent.click(accountSelector);
    expect(screen.getByRole("option", { name: /Caja principal/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Caja inactiva/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId("ingreso-manual-importe"), { target: { value: "1250.50" } });
    fireEvent.change(screen.getByTestId("ingreso-manual-fecha"), { target: { value: "2026-09-24" } });
    fireEvent.change(screen.getByTestId("ingreso-manual-descripcion"), { target: { value: "Aporte de capital" } });
    fireEvent.click(screen.getByTestId("modal-submit"));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    const input = onCreate.mock.calls[0][0];
    expect(input).toMatchObject({
      cuentaId: activeAccount.id,
      importe: 1250.5,
      descripcion: "Aporte de capital",
    });
    expect(formatLocalDateLabel(input.fecha)).toBe("24/09/2026");
    expect(input.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("conserva el día elegido aunque se registre cerca de la medianoche local", () => {
    const timestamp = toISODateTimeWithLocalCurrentTime("2026-09-24", new Date(2026, 8, 24, 23, 55));
    expect(timestamp).not.toBeNull();
    expect(formatLocalDateLabel(timestamp)).toBe("24/09/2026");
  });

  it("mantiene la misma clave de idempotencia al reintentar sin cambiar los datos", async () => {
    const onCreate = vi.fn()
      .mockRejectedValueOnce(new Error("Error temporal"))
      .mockResolvedValueOnce(undefined);

    render(
      <IngresoManualFinancieroModal
        open
        cuentas={[activeAccount]}
        onClose={vi.fn()}
        onCreate={onCreate}
      />
    );
    await screen.findByTestId("ingreso-manual-cuenta");
    fireEvent.change(screen.getByTestId("ingreso-manual-importe"), { target: { value: "100" } });
    fireEvent.change(screen.getByTestId("ingreso-manual-descripcion"), { target: { value: "Aporte" } });

    fireEvent.click(screen.getByTestId("modal-submit"));
    await screen.findByTestId("modal-error");
    fireEvent.click(screen.getByTestId("modal-submit"));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(2));
    expect(onCreate.mock.calls[0][0].idempotencyKey).toBe(onCreate.mock.calls[1][0].idempotencyKey);
  });
});

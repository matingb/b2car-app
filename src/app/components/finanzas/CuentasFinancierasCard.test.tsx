import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CuentasFinancierasCard from "./CuentasFinancierasCard";

describe("CuentasFinancierasCard", () => {
  it("permite marcar una cuenta activa como favorita sin abrir su detalle", () => {
    const onClick = vi.fn();
    const onFavorite = vi.fn();

    render(
      <CuentasFinancierasCard
        nombre="Caja principal"
        tipo="EFECTIVO"
        saldo={1500}
        activo
        favorita={false}
        onClick={onClick}
        onFavorite={onFavorite}
      />
    );

    fireEvent.click(screen.getByTestId("cuenta-favorita-button-Caja principal"));

    expect(onFavorite).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("identifica visualmente la cuenta favorita y previene clicks", () => {
    const onClick = vi.fn();
    const onFavorite = vi.fn();

    render(
      <CuentasFinancierasCard
        nombre="Banco"
        tipo="CUENTA_BANCARIA"
        saldo={0}
        activo
        favorita
        onClick={onClick}
        onFavorite={onFavorite}
      />
    );

    const favoriteButton = screen.getByTestId("cuenta-favorita-button-Banco");
    expect(favoriteButton).toHaveAttribute("aria-pressed", "true");
    expect(favoriteButton).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(favoriteButton);

    expect(onFavorite).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });
});

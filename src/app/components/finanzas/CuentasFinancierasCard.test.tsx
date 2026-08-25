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

    fireEvent.click(screen.getByRole("button", { name: "Marcar Caja principal como favorita" }));

    expect(onFavorite).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("identifica visual y semanticamente la cuenta favorita", () => {
    render(
      <CuentasFinancierasCard
        nombre="Banco"
        tipo="CUENTA_BANCARIA"
        saldo={0}
        activo
        favorita
        onFavorite={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Banco es la cuenta favorita" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});

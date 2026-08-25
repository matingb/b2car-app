import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CuentaFavoritaButton from "./CuentaFavoritaButton";

describe("CuentaFavoritaButton", () => {
  it("permite clickear y ejecuta onFavorite cuando no es favorita", () => {
    const onFavorite = vi.fn();
    const onParentClick = vi.fn();

    render(
      <div onClick={onParentClick}>
        <CuentaFavoritaButton favorita={false} onFavorite={onFavorite} />
      </div>
    );

    const button = screen.getByTestId("cuenta-favorita-button");
    expect(button).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(button);

    expect(onFavorite).toHaveBeenCalledTimes(1);
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it("no permite clickear ni propaga el click cuando ya es favorita", () => {
    const onFavorite = vi.fn();
    const onParentClick = vi.fn();

    render(
      <div onClick={onParentClick}>
        <CuentaFavoritaButton favorita={true} onFavorite={onFavorite} />
      </div>
    );

    const button = screen.getByTestId("cuenta-favorita-button");
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(button);

    expect(onFavorite).not.toHaveBeenCalled();
    expect(onParentClick).not.toHaveBeenCalled();
  });
});

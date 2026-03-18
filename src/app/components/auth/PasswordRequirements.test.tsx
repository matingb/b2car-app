import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PasswordRequirements from "./PasswordRequirements";

const MET_COLOR = "#007995";
const UNMET_COLOR = "#7F7F7F";

function renderRequirements(password = "", confirmPassword = "") {
  const { rerender } = render(
    <PasswordRequirements password={password} confirmPassword={confirmPassword} />
  );
  return { rerender };
}

describe("PasswordRequirements", () => {
  it("muestra todos los requisitos en gris cuando no se cumplen los requisitos", () => {
    renderRequirements();

    expect(screen.getByTestId("password-requirement-min-length")).toHaveStyle({ color: UNMET_COLOR });
    expect(screen.getByTestId("password-requirement-has-number")).toHaveStyle({ color: UNMET_COLOR });
    expect(screen.getByTestId("password-requirement-has-lowercase")).toHaveStyle({ color: UNMET_COLOR });
    expect(screen.getByTestId("password-requirement-has-uppercase")).toHaveStyle({ color: UNMET_COLOR });
    expect(screen.getByTestId("password-requirement-has-special-character")).toHaveStyle({ color: UNMET_COLOR });
    expect(screen.getByTestId("password-requirement-matches")).toHaveStyle({ color: UNMET_COLOR });
  });

  it("marca en color los requisitos cumplidos", () => {
    const { rerender } = renderRequirements("Abcdefgh1!", "Abcdefgh2!");

    expect(screen.getByTestId("password-requirement-min-length")).toHaveStyle({ color: MET_COLOR });
    expect(screen.getByTestId("password-requirement-has-number")).toHaveStyle({ color: MET_COLOR });
    expect(screen.getByTestId("password-requirement-has-lowercase")).toHaveStyle({ color: MET_COLOR });
    expect(screen.getByTestId("password-requirement-has-uppercase")).toHaveStyle({ color: MET_COLOR });
    expect(screen.getByTestId("password-requirement-has-special-character")).toHaveStyle({ color: MET_COLOR });
    expect(screen.getByTestId("password-requirement-matches")).toHaveStyle({ color: UNMET_COLOR });

    rerender(<PasswordRequirements password="Abcdefgh1!" confirmPassword="Abcdefgh1!" />);

    expect(screen.getByTestId("password-requirement-matches")).toHaveStyle({ color: MET_COLOR });
  });
});

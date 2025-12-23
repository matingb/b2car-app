import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { runPendingPromises } from "@/tests/testUtils";
import { AuthActionError } from "./authTypes";

const { pushMock, loginMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  loginMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    back: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));


vi.mock("./actions", () => ({
  login: loginMock,
}));

import LoginPage from "./page";

describe("LoginPage", () => {
  beforeEach(() => {
    pushMock.mockClear();
    loginMock.mockReset();
  });

  it("redirige a la pagina principal cuando el login es exitoso", async () => {
    loginMock.mockResolvedValueOnce({ ok: true });

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "password");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await runPendingPromises();
    expect(pushMock).toHaveBeenCalledWith("/");
  });

  it("muestra el mensaje de error cuando las credenciales son inválidas", async () => {
    loginMock.mockResolvedValueOnce({
      ok: false,
      error: AuthActionError.INVALID_CREDENTIALS,
    });

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "wrong");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await runPendingPromises();
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("invalid-credentials-error")).toHaveTextContent(
      "Email o contraseña incorrectos"
    );
  });
});



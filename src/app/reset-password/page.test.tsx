import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { runPendingPromises } from "@/tests/testUtils";

const {
  pushMock,
  successMock,
  resetPasswordMock,
  searchParamsState,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  successMock: vi.fn(),
  resetPasswordMock: vi.fn(),
  searchParamsState: {
    access_token: "recovery-token",
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    back: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: (key: string) => searchParamsState[key as keyof typeof searchParamsState] ?? null,
  }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: successMock,
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock("./actions", () => ({
  resetPassword: resetPasswordMock,
}));

import ResetPasswordPage from "./page";

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    successMock.mockReset();
    resetPasswordMock.mockReset();
    searchParamsState.access_token = "recovery-token";
  });

  it("deshabilita el botón hasta que la contraseña cumpla con los requisitos", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    const passwordInput = screen.getByLabelText("Nueva contraseña");
    const confirmInput = screen.getByLabelText("Confirmar contraseña");
    const submitButton = screen.getByRole("button", { name: "Actualizar contraseña" });

    expect(submitButton).toBeDisabled();

    await user.type(passwordInput, "Abcdefgh1!");
    await user.type(confirmInput, "Abcdefgh2!");

    expect(submitButton).toBeDisabled();
  });

  it("resetea la contraseña y redirige al raiz", async () => {
    resetPasswordMock.mockResolvedValueOnce({ ok: true });

    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await user.type(screen.getByLabelText("Nueva contraseña"), "Password1!");
    await user.type(screen.getByLabelText("Confirmar contraseña"), "Password1!");
    await user.click(screen.getByRole("button", { name: "Actualizar contraseña" }));

    await runPendingPromises();

    expect(resetPasswordMock).toHaveBeenCalledWith({
      token: "recovery-token",
      password: "Password1!",
    });
    expect(successMock).toHaveBeenCalledWith(
      "Contraseña actualizada",
      "Ya podes iniciar sesión con tu nueva contraseña."
    );
    expect(pushMock).toHaveBeenCalledWith("/");
  });
});

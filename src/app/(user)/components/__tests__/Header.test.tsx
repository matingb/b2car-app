import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect } from "vitest";
import Header from "../Header";

const signOutMock = vi.fn();

vi.mock("@/app/(user)/providers/SessionProvider", () => ({
  useSession: () => ({ signOut: signOutMock }),
}));

describe("Header", () => {
  it("hacer signOut al hacer click en Cerrar sesión", async () => {
    render(<Header />);
    const button = screen.getByRole("button", { name: /cerrar sesión/i });
    await userEvent.click(button);
    expect(signOutMock).toHaveBeenCalled();
  });
});



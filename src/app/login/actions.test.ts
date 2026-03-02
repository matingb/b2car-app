import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthActionError } from "./authTypes";

const { createClientMock, decodeJwtPayloadMock, revalidatePathMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  decodeJwtPayloadMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/jwt", () => ({
  decodeJwtPayload: decodeJwtPayloadMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { login } from "./actions";

describe("login action", () => {
  const signInWithPasswordMock = vi.fn();
  const signOutMock = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    signOutMock.mockResolvedValue({ error: null });
    createClientMock.mockResolvedValue({
      auth: {
        signInWithPassword: signInWithPasswordMock,
        signOut: signOutMock,
      },
    });
  });

  it("devuelve INVALID_CREDENTIALS cuando Supabase informa credenciales inválidas", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "Invalid login credentials" },
    });

    const result = await login("test@example.com", "bad-pass");

    expect(result).toEqual({
      ok: false,
      error: AuthActionError.INVALID_CREDENTIALS,
    });
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("devuelve UNKNOWN cuando Supabase informa NO_TENANT durante el sign in", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "NO_TENANT" },
    });

    const result = await login("test@example.com", "pass");

    expect(result).toEqual({
      ok: false,
      error: AuthActionError.UNKNOWN,
      message: "Tu usuario no tiene un tenant asignado.",
    });
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("devuelve TENANT_INACTIVE cuando Supabase informa tenant inactivo en sign in", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "TENANT_INACTIVE" },
    });

    const result = await login("test@example.com", "pass");

    expect(result).toEqual({
      ok: false,
      error: AuthActionError.TENANT_INACTIVE,
      message: "Tu organización está inactiva o no tiene acceso.",
    });
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("limpia sesión y devuelve UNKNOWN cuando el JWT trae NO_TENANT", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { session: { access_token: "a.b.c" }, user: { id: "u1" } },
      error: null,
    });
    decodeJwtPayloadMock.mockReturnValue({
      sub: "u1",
      error: "NO_TENANT",
      error_description: "Sin tenant",
    });

    const result = await login("test@example.com", "pass");

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: false,
      error: AuthActionError.UNKNOWN,
      message: "Sin tenant",
    });
  });

  it("limpia sesión y devuelve TENANT_INACTIVE cuando falta tenant_id en JWT", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { session: { access_token: "a.b.c" }, user: { id: "u1" } },
      error: null,
    });
    decodeJwtPayloadMock.mockReturnValue({
      sub: "u1",
      tenant_name: "B2Car",
    });

    const result = await login("test@example.com", "pass");

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: false,
      error: AuthActionError.TENANT_INACTIVE,
      message: "Tu organización está inactiva o no tiene acceso.",
    });
  });

  it("devuelve ok=true y tenant_name cuando el JWT es válido", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { session: { access_token: "a.b.c" }, user: { id: "u1" } },
      error: null,
    });
    decodeJwtPayloadMock.mockReturnValue({
      sub: "u1",
      tenant_id: "t1",
      tenant_name: "Tenant Demo",
    });

    const result = await login("test@example.com", "pass");

    expect(result).toEqual({ ok: true, tenant_name: "Tenant Demo" });
    expect(signOutMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
  });
});

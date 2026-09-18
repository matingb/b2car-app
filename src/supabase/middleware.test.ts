import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getClaims: mocks.getClaims,
      getUser: mocks.getUser,
    },
  }),
}));

import { updateSession } from "./middleware";

beforeEach(() => {
  mocks.getUser.mockReset();
  mocks.getClaims.mockReset();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  mocks.getClaims.mockResolvedValue({
    data: { claims: { plan_sub: "PRO", user_role: "admin" } },
    error: null,
  });
});

describe("middleware session and landing redirects", () => {
  it("redirecciona a /login si no hay usuario autenticado", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    const response = await updateSession(new NextRequest("http://localhost/dashboard"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("permite acceso a /login sin usuario autenticado", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    const response = await updateSession(new NextRequest("http://localhost/login"));
    expect(response.status).toBe(200);
  });

  it("permite acceso a manifest e iconos sin redirección", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    const response = await updateSession(new NextRequest("http://localhost/manifest.json"));
    expect(response.status).toBe(200);
  });

  it("redirects operativo from root / to /arreglos", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { plan_sub: "PRO", user_role: "operativo" } },
      error: null,
    });

    const response = await updateSession(new NextRequest("http://localhost/"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/arreglos");
  });

  it("redirects admin from root / to /dashboard", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { plan_sub: "PRO", user_role: "admin" } },
      error: null,
    });

    const response = await updateSession(new NextRequest("http://localhost/"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("permite el paso de requests autenticadas (la protección visual es de AppClientLayout y de APIs es por route handler)", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { plan_sub: "PRO", user_role: "operativo" } },
      error: null,
    });

    const response = await updateSession(new NextRequest("http://localhost/api/operaciones"));
    expect(response.status).toBe(200);

    const pageResponse = await updateSession(new NextRequest("http://localhost/operaciones"));
    expect(pageResponse.status).toBe(200);
  });
});

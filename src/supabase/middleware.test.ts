import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { API_ERROR_MESSAGES } from "@/lib/apiErrorCodes";

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  createServerClientOptions: null as {
    cookies?: {
      setAll?: (cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => void;
    };
  } | null,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: typeof mocks.createServerClientOptions,
  ) => {
    mocks.createServerClientOptions = options;
    return {
      auth: {
        getClaims: mocks.getClaims,
      },
    };
  },
}));

import { updateSession } from "./middleware";
import { config as middlewareConfig } from "@/middleware";

beforeEach(() => {
  mocks.getClaims.mockReset();
  mocks.createServerClientOptions = null;
  mocks.getClaims.mockResolvedValue({
    data: { claims: { sub: "user-1", plan_sub: "PRO", user_role: "admin" } },
    error: null,
  });
});

describe("middleware session and landing redirects", () => {
  it("redirecciona a /login si no hay usuario autenticado en una página", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: null }, error: null });

    const response = await updateSession(new NextRequest("http://localhost/dashboard"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("devuelve 401 JSON en rutas /api cuando no hay usuario autenticado", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: null }, error: null });

    const response = await updateSession(new NextRequest("http://localhost/api/operaciones"));
    expect(response.status).toBe(401);
    expect(response.headers.get("location")).toBeNull();
    await expect(response.json()).resolves.toEqual({
      data: null,
      error: API_ERROR_MESSAGES.UNAUTHORIZED,
      code: "UNAUTHORIZED",
    });
  });

  it("propaga las cookies limpiadas en redirecciones y respuestas 401", async () => {
    mocks.getClaims.mockImplementation(async () => {
      mocks.createServerClientOptions?.cookies?.setAll?.([
        { name: "sb-auth-token", value: "", options: { maxAge: 0, path: "/" } },
      ]);
      return { data: null, error: null };
    });

    const pageResponse = await updateSession(new NextRequest("http://localhost/clientes"));
    expect(pageResponse.status).toBe(307);
    expect(pageResponse.cookies.get("sb-auth-token")?.value).toBe("");

    const apiResponse = await updateSession(new NextRequest("http://localhost/api/clientes"));
    expect(apiResponse.status).toBe(401);
    expect(apiResponse.cookies.get("sb-auth-token")?.value).toBe("");
  });

  it("permite acceso a rutas públicas sin usuario autenticado", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: null }, error: null });

    for (const path of ["/login", "/reset-password", "/auth/callback", "/api/auth/callback", "/error"]) {
      const response = await updateSession(new NextRequest(`http://localhost${path}`));
      expect(response.status).toBe(200);
    }
  });

  it("permite acceso a manifest e iconos sin redirección", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: null }, error: null });

    const response = await updateSession(new NextRequest("http://localhost/manifest.json"));
    expect(response.status).toBe(200);
  });

  it("deja que la página raíz resuelva los permisos de un rol personalizado", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1", plan_sub: "PRO", user_role: "operativo_arturo" } },
      error: null,
    });

    const response = await updateSession(new NextRequest("http://localhost/"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("deja que la página raíz elija el destino del admin según sus permisos", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1", plan_sub: "PRO", user_role: "admin" } },
      error: null,
    });

    const response = await updateSession(new NextRequest("http://localhost/"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
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

  it("usa un matcher genérico que cubre páginas y APIs nuevas y excluye estáticos", () => {
    expect(middlewareConfig.matcher).toHaveLength(1);
    const pattern = new RegExp(`^${middlewareConfig.matcher[0]}$`);

    expect(pattern.test("/")).toBe(true);
    expect(pattern.test("/cuentas-financieras")).toBe(true);
    expect(pattern.test("/proveedores/123")).toBe(true);
    expect(pattern.test("/api/proveedores")).toBe(true);
    expect(pattern.test("/api/empleados/1")).toBe(true);
    expect(pattern.test("/api/nuevo-modulo")).toBe(true);

    expect(pattern.test("/_next/static/chunks/app.js")).toBe(false);
    expect(pattern.test("/_next/image")).toBe(false);
    expect(pattern.test("/favicon.ico")).toBe(false);
    expect(pattern.test("/manifest.webmanifest")).toBe(false);
    expect(pattern.test("/service-worker.js")).toBe(false);
    expect(pattern.test("/icons/icon-192.png")).toBe(false);
    expect(pattern.test("/logos/logoGrande.svg")).toBe(false);
  });
});

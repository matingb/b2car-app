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

describe("tiering middleware", () => {
  it("returns 403 for BASE billing APIs, including child routes", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { plan_sub: "BASE", user_role: "admin" } },
      error: null,
    });

    const response = await updateSession(
      new NextRequest("http://localhost/api/facturas/invoice-1/pdf"),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "FEATURE_NOT_AVAILABLE_FOR_PLAN" });
  });

  it("returns 403 for every BASE settings and embedded billing API family", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { plan_sub: "BASE", user_role: "admin" } },
      error: null,
    });

    const settings = await updateSession(
      new NextRequest("http://localhost/api/facturacion/configuracion/probar", { method: "POST" }),
    );
    const embedded = await updateSession(
      new NextRequest("http://localhost/api/arreglos/arreglo-1/factura"),
    );
    const embeddedOperation = await updateSession(
      new NextRequest("http://localhost/api/operaciones/operacion-1/factura"),
    );
    const fiscalCondition = await updateSession(
      new NextRequest("http://localhost/api/fiscal/condicion-iva"),
    );

    expect(settings.status).toBe(403);
    expect(embedded.status).toBe(403);
    expect(embeddedOperation.status).toBe(403);
    expect(fiscalCondition.status).toBe(403);
  });

  it("redirects BASE page navigation to dashboard and allows PRO", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { plan_sub: "BASE", user_role: "admin" } },
      error: null,
    });
    const blocked = await updateSession(new NextRequest("http://localhost/facturacion"));

    expect(blocked.status).toBe(307);
    expect(blocked.headers.get("location")).toBe("http://localhost/dashboard");

    const blockedSettings = await updateSession(new NextRequest("http://localhost/configuracion"));
    expect(blockedSettings.status).toBe(307);
    expect(blockedSettings.headers.get("location")).toBe("http://localhost/dashboard");

    mocks.getClaims.mockResolvedValue({
      data: { claims: { plan_sub: "PRO", user_role: "admin" } },
      error: null,
    });
    const allowed = await updateSession(new NextRequest("http://localhost/api/facturas"));

    expect(allowed.status).toBe(200);
  });
});

describe("roles and permissions middleware", () => {
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

  it("bloquea páginas financieras y administrativas para rol operativo redirigiendo a /arreglos", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { plan_sub: "PRO", user_role: "operativo" } },
      error: null,
    });

    const rutasBloqueadas = [
      "/dashboard",
      "/operaciones",
      "/cuentas-financieras",
      "/facturacion",
      "/empleados",
      "/productos",
      "/configuracion",
    ];

    for (const ruta of rutasBloqueadas) {
      const response = await updateSession(new NextRequest(`http://localhost${ruta}`));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost/arreglos");
    }
  });

  it("responde 403 a llamadas de API restringidas cuando el rol es operativo", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { plan_sub: "PRO", user_role: "operativo" } },
      error: null,
    });

    const apisBloqueadas = [
      "/api/dashboard/stats",
      "/api/operaciones",
      "/api/cuentas-financieras",
      "/api/gastos",
      "/api/facturas",
      "/api/empleados",
      "/api/productos",
      "/api/clientes/123/cuenta-corriente",
      "/api/arreglos/123/cobro",
    ];

    for (const api of apisBloqueadas) {
      const response = await updateSession(new NextRequest(`http://localhost${api}`));
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        error: "FORBIDDEN_INSUFFICIENT_PERMISSIONS",
      });
    }
  });

  it("permite a operativo acceder a arreglos y a la API de repuestos", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { plan_sub: "PRO", user_role: "operativo" } },
      error: null,
    });

    const allowedPage = await updateSession(new NextRequest("http://localhost/arreglos"));
    expect(allowedPage.status).toBe(200);

    const allowedApi = await updateSession(
      new NextRequest("http://localhost/api/arreglos/123/repuestos", { method: "POST" }),
    );
    expect(allowedApi.status).toBe(200);
  });
});

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
  mocks.getClaims.mockResolvedValue({ data: { claims: { plan_sub: "PRO" } }, error: null });
});

describe("tiering middleware", () => {
  it("returns 403 for BASE billing APIs, including child routes", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { plan_sub: "BASE" } }, error: null });

    const response = await updateSession(
      new NextRequest("http://localhost/api/facturas/invoice-1/pdf"),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "FEATURE_NOT_AVAILABLE_FOR_PLAN" });
  });

  it("returns 403 for every BASE settings and embedded billing API family", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { plan_sub: "BASE" } }, error: null });

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
    mocks.getClaims.mockResolvedValue({ data: { claims: { plan_sub: "BASE" } }, error: null });
    const blocked = await updateSession(new NextRequest("http://localhost/facturacion"));

    expect(blocked.status).toBe(307);
    expect(blocked.headers.get("location")).toBe("http://localhost/dashboard");

    const blockedSettings = await updateSession(new NextRequest("http://localhost/configuracion"));
    expect(blockedSettings.status).toBe(307);
    expect(blockedSettings.headers.get("location")).toBe("http://localhost/dashboard");

    mocks.getClaims.mockResolvedValue({ data: { claims: { plan_sub: "PRO" } }, error: null });
    const allowed = await updateSession(new NextRequest("http://localhost/api/facturas"));

    expect(allowed.status).toBe(200);
  });
});

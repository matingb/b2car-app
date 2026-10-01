import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createClient } from "@/supabase/server";
import { fetchEffectivePermissions, fetchPlanPermissions } from "@/lib/permissions.server";
import { Permission } from "@/lib/permissions";
import { logger } from "@/lib/logger";
import { mockApiSession } from "@/tests/apiRoute";
import { ApiError } from "./apiError";
import { createApiHandler, type ApiHandlerContext } from "./apiHandler";
import { parseInput, readJsonBody } from "./apiInput";

vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/permissions.server", () => ({ fetchEffectivePermissions: vi.fn(), fetchPlanPermissions: vi.fn() }));

const options = { route: "POST /api/test", fallback: "No se pudo guardar", errorBody: { data: null } };
const segment = () => ({ params: Promise.resolve({}) });
const request = (body = "{}") => new NextRequest("http://localhost/api/test?secret=excluded", { method: "POST", body });

beforeEach(() => {
  vi.clearAllMocks();
  mockApiSession();
  vi.spyOn(logger, "debug").mockImplementation(() => {});
  vi.spyOn(logger, "warn").mockImplementation(() => {});
  vi.spyOn(logger, "error").mockImplementation(() => {});
});

describe("createApiHandler", () => {
  it("rejects invalid claims before permissions, input or controller", async () => {
    mockApiSession({ claims: null });
    const req = request("{");
    const read = vi.spyOn(req, "json");
    const controller = vi.fn(async (ctx: ApiHandlerContext) => Response.json(await ctx.req.json()));
    const handler = createApiHandler({ ...options, permission: Permission.FinanzasEdit }, controller);
    const response = await handler(req, segment());
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ data: null, code: "UNAUTHORIZED", error: expect.any(String) });
    expect(fetchEffectivePermissions).not.toHaveBeenCalled();
    expect(fetchPlanPermissions).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    expect(controller).not.toHaveBeenCalled();
  });

  it.each([
    { planPermissions: [Permission.FinanzasEdit], code: "FORBIDDEN" },
    { planPermissions: [], code: "FEATURE_NOT_AVAILABLE_FOR_PLAN" },
  ])("rejects missing access before reading input: $code", async ({ planPermissions, code }) => {
    mockApiSession({ permissions: [], planPermissions });
    const req = request("{");
    const read = vi.spyOn(req, "json");
    const controller = vi.fn(async (ctx: ApiHandlerContext) => Response.json(await ctx.req.json()));
    const handler = createApiHandler({ ...options, permission: Permission.FinanzasEdit }, controller);
    const response = await handler(req, segment());
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ data: null, code });
    expect(read).not.toHaveBeenCalled();
    expect(controller).not.toHaveBeenCalled();
  });

  it.each([
    { raw: "{", message: "JSON inválido" },
    { raw: "{}", message: "Falta nombre" },
  ])("maps input errors thrown by the controller before business logic: $message", async ({ raw, message }) => {
    const save = vi.fn();
    const handler = createApiHandler(options, async (ctx) => {
      const input = parseInput(() => ({ error: "Falta nombre" }), await readJsonBody(ctx.req));
      save(input);
      return Response.json({ ok: true });
    });
    const response = await handler(request(raw), segment());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ data: null, code: "VALIDATION", error: message });
    expect(save).not.toHaveBeenCalled();
  });

  it("passes raw params and the original request for the controller to read", async () => {
    const id = "unvalidated-id";
    const req = new NextRequest("http://localhost/api/test?page=2", { method: "POST", body: '{"nombre":" Caja "}' });
    const read = vi.spyOn(req, "json");
    const handler = createApiHandler(options, async (ctx) => {
      expect(ctx.req).toBe(req);
      expect(read).not.toHaveBeenCalled();
      return Response.json({ params: ctx.params, page: ctx.req.nextUrl.searchParams.get("page"), body: await ctx.req.json() });
    });
    const response = await handler(req, { params: Promise.resolve({ id }) });
    expect(await response.json()).toEqual({ params: { id }, page: "2", body: { nombre: " Caja " } });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("does not read the body and can() never reloads auth", async () => {
    const { getClaims } = mockApiSession({ permissions: [] });
    const req = request("{");
    const read = vi.spyOn(req, "json");
    const handler = createApiHandler(options, async (ctx) => {
      expect(ctx.params).toEqual({});
      expect(ctx.can(Permission.FinanzasEdit)).toBe(false);
      expect(ctx.can(Permission.FinanzasView)).toBe(false);
      return Response.json({ ok: true });
    });
    expect((await handler(req, segment())).status).toBe(200);
    expect(read).not.toHaveBeenCalled();
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(getClaims).toHaveBeenCalledTimes(1);
    expect(fetchEffectivePermissions).toHaveBeenCalledTimes(1);
    expect(fetchPlanPermissions).not.toHaveBeenCalled();
  });

  it("returns a safe 500 and correlates controller, error and access logs", async () => {
    const info = vi.spyOn(logger, "info").mockImplementation(() => {});
    let requestId = "";
    const original = new Error("private table failure");
    const handler = createApiHandler(options, async (ctx) => {
      requestId = ctx.requestId;
      ctx.log.info("Guardando");
      throw original;
    });
    const response = await handler(request(), segment());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ data: null, code: "INTERNAL", error: options.fallback, errorId: requestId });
    expect(info).toHaveBeenCalledWith(`[POST /api/test req=${requestId}]`, "Guardando");
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(requestId), expect.objectContaining({
      requestId, errorId: requestId, userId: "11111111-1111-4111-8111-111111111111", tenantId: "22222222-2222-4222-8222-222222222222",
    }), original);
    expect(logger.debug).toHaveBeenCalledWith(`[POST /api/test req=${requestId}]`, "Request completado", expect.objectContaining({
      requestId, method: "POST", route: options.route, status: 500, durationMs: expect.any(Number),
    }));
    expect(JSON.stringify(vi.mocked(logger.debug).mock.calls)).not.toContain("secret");
  });

  it("preserves a controller's ApiError", async () => {
    const handler = createApiHandler(options, async () => { throw new ApiError(409, "No se puede modificar", "INMUTABLE"); });
    const response = await handler(request(), segment());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ data: null, error: "No se puede modificar", code: "INMUTABLE" });
  });

  it.each(["effective", "plan"])("handles %s permission loading failures as safe 500s before mutation", async (step) => {
    const controller = vi.fn();
    if (step === "effective") vi.mocked(fetchEffectivePermissions).mockRejectedValueOnce(new Error("Permission DB failed"));
    else {
      mockApiSession({ permissions: [] });
      vi.mocked(fetchPlanPermissions).mockRejectedValueOnce(new Error("Plan DB failed"));
    }
    const handler = createApiHandler({ ...options, permission: Permission.FinanzasEdit }, controller);
    const response = await handler(request(), segment());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ data: null, error: options.fallback, errorId: expect.any(String) });
    expect(controller).not.toHaveBeenCalled();
  });

  it("uses domain mapping before common mapping for exceptions and fail()", async () => {
    const error = { code: "23505", message: "technical duplicate" };
    for (const shouldThrow of [false, true]) {
      const mapError = vi.fn(() => ({ status: 400 as const, code: "VALIDATION" as const, message: "Regla de dominio" }));
      const handler = createApiHandler({ ...options, mapError }, async (ctx) => {
        if (shouldThrow) throw error;
        return ctx.fail(error);
      });
      const response = await handler(request(), segment());
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ data: null, code: "VALIDATION", error: "Regla de dominio" });
      expect(mapError).toHaveBeenCalledWith(error);
    }
  });

  it("fail() keeps response fields, constraint messages and useful IDs", async () => {
    const handler = createApiHandler(options, async (ctx) => ctx.fail({ code: "23505", constraint: "uq_example" }, {
      constraintMessages: { uq_example: "Nombre duplicado" }, extra: { cuentaId: "account" },
    }));
    const response = await handler(request(), segment());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ data: null, code: "CONFLICT", error: "Nombre duplicado" });
    expect(logger.warn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ cuentaId: "account", requestId: expect.any(String) }));
  });
});

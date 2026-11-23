import "server-only";

import type { NextRequest } from "next/server";
import { API_ERROR_MESSAGES } from "@/lib/apiErrorCodes";
import { createScopedLogger, shouldLog, type ScopedLogger } from "@/lib/logger";
import type { PermissionValue } from "@/lib/permissions";
import { generateUuidV4 } from "@/lib/uuid";
import { buildApiContext, type ApiContext } from "./apiContext";
import { assertAnyPermission, assertPermission } from "./apiAccess";
import { apiErrorResponse, type DbErrorOptions, type MappedApiError } from "./apiError";
import { telemetry } from "@/lib/telemetry";

export type ApiHandlerOptions = {
  route: string;
  fallback?: string;
  permission?: PermissionValue | readonly PermissionValue[];
  anyPermission?: readonly PermissionValue[];
  errorBody?: Record<string, unknown>;
  mapError?: (error: unknown) => MappedApiError | null;
};

export type ApiHandlerContext = ApiContext & {
  req: NextRequest;
  params: Record<string, string>;
  requestId: string;
  log: ScopedLogger;
  fail(error: unknown, opts?: DbErrorOptions & { extra?: Record<string, unknown> }): Response;
};

function extractHttpRoute(route: string): string {
  return route.replace(/^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+/i, "");
}

export function createApiHandler(
  options: ApiHandlerOptions,
  controller: (ctx: ApiHandlerContext) => Promise<Response>,
): (req: NextRequest, segment: { params: Promise<Record<string, string>> }) => Promise<Response> {
  return async (req, segment) => {

    const startedAt = performance.now();
    const requestId = generateUuidV4().slice(0, 8);
    const scope = `${options.route} req=${requestId}`;
    const log = createScopedLogger(scope);
    let context: ApiContext | undefined;
    let response: Response | undefined;

    telemetry.setAttributes({
      "api.route": options.route,
      "http.route": extractHttpRoute(options.route),
    });

    const fail: ApiHandlerContext["fail"] = (error, opts = {}) => apiErrorResponse(error, {
      ...opts,
      context: scope,
      fallback: opts.fallback ?? options.fallback ?? API_ERROR_MESSAGES.INTERNAL,
      body: options.errorBody,
      mapError: options.mapError,
      errorId: requestId,
      extra: {
        ...opts.extra,
        requestId,
        ...(context ? { userId: context.actor.userId, tenantId: context.actor.tenantId } : {}),
      },
    });

    try {
      context = await buildApiContext();
      const identity = {
        user: { id: context.actor.userId, role: context.actor.role, email: context.actor.email },
        account: { id: context.actor.tenantId, name: context.actor.tenantName, plan: context.actor.plan },
      };
      telemetry.identify(identity);
      if (options.permission) await assertPermission(context, options.permission);
      if (options.anyPermission) await assertAnyPermission(context, options.anyPermission);
      const params = await segment.params;
      const ctx = { ...context, req, params, requestId, log, fail };
      response = await telemetry.withIdentity(identity, () => controller(ctx));
    } catch (error) {
      response = fail(error);
      if (response.status >= 500 && !shouldLog("error")) {
        telemetry.recordException(error, { route: options.route });
      }
    } finally {
      const status = response?.status ?? 500;
      telemetry.setAttributes({
        "http.response.status_code": status,
      });
      log.debug("Request completado", {
        method: req.method,
        route: options.route,
        status,
        durationMs: performance.now() - startedAt,
        requestId,
      });
    }
    return response;
  };
}

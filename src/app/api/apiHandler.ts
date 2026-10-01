import "server-only";

import type { NextRequest } from "next/server";
import { API_ERROR_MESSAGES } from "@/lib/apiErrorCodes";
import { createScopedLogger, type ScopedLogger } from "@/lib/logger";
import type { PermissionValue } from "@/lib/permissions";
import { generateUuidV4 } from "@/lib/uuid";
import { buildApiContext, type ApiContext } from "./apiContext";
import { assertPermission } from "./apiAccess";
import { apiErrorResponse, type DbErrorOptions, type MappedApiError } from "./apiError";

export type ApiHandlerOptions = {
  route: string;
  fallback?: string;
  permission?: PermissionValue | readonly PermissionValue[];
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
      if (options.permission) await assertPermission(context, options.permission);
      const params = await segment.params;
      response = await controller({ ...context, req, params, requestId, log, fail });
    } catch (error) {
      response = fail(error);
    } finally {
      log.debug("Request completado", {
        method: req.method,
        route: options.route,
        status: response?.status ?? 500,
        durationMs: performance.now() - startedAt,
        requestId,
      });
    }
    return response;
  };
}

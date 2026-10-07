import type { Instrumentation } from "next";
import { logger } from "@/lib/logger";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.DD_TRACE_ENABLED === "false") {
      return;
    }

    const apiKey = process.env.DD_API_KEY;
    if (!apiKey) {
      return;
    }

    process.env.DD_AGENTLESS_ENABLED = "true";
    process.env.DD_SITE = "datadoghq.com";
    process.env.DD_API_KEY = apiKey;

    const tracer = (await import("dd-trace")).default;
    tracer.init({
      service: "b2car-backend",
      env: process.env.NEXT_PUBLIC_DATADOG_ENV || "production",
      version: process.env.NEXT_PUBLIC_APP_VERSION,
      site: "datadoghq.com",
      logInjection: true,
    });
  }
}

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  logger.error("[onRequestError]", {
    // Query parameters can contain tokens or personal data.
    path: request.path.split("?")[0],
    method: request.method,
    routeType: context.routeType,
  }, error);
};

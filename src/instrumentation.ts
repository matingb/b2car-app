import type { Instrumentation } from "next";
import { logger } from "@/lib/logger";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { telemetry } = await import("@/lib/telemetry");
    await telemetry.initServer();
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

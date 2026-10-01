import { describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/logger";
import { onRequestError } from "./instrumentation";

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

describe("onRequestError", () => {
  it("logs the route, method and original exception without headers or query parameters", () => {
    const error = new Error("Unhandled route error");
    onRequestError(error, {
      path: "/api/arreglos/record-1?token=private-token&email=personal@example.test",
      method: "PUT",
      headers: { authorization: "Bearer private-token", cookie: "session=private-session" },
    }, {
      routerKind: "App Router",
      routePath: "/api/arreglos/[id]",
      routeType: "route",
      revalidateReason: undefined,
    });

    expect(logger.error).toHaveBeenCalledWith("[onRequestError]", {
      path: "/api/arreglos/record-1",
      method: "PUT",
      routeType: "route",
    }, error);
    expect(error.stack).toContain("Unhandled route error");
    const log = JSON.stringify(vi.mocked(logger.error).mock.calls);
    expect(log).not.toContain("private-token");
    expect(log).not.toContain("private-session");
    expect(log).not.toContain("personal@example.test");
  });
});

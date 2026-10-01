import { describe, expect, it, vi } from "vitest";
import { createScopedLogger, logger } from "./logger";

describe("createScopedLogger", () => {
  it.each(["debug", "info", "warn", "error"] as const)("prefixes %s and preserves payloads", (level) => {
    const spy = vi.spyOn(logger, level).mockImplementation(() => {});
    const payload = { requestId: "1234abcd" };
    const error = new Error("failure");
    createScopedLogger("POST /api/example req=1234abcd")[level]("Contexto", payload, error);
    expect(spy).toHaveBeenCalledWith("[POST /api/example req=1234abcd]", "Contexto", payload, error);
  });
});

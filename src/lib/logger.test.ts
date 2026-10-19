import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScopedLogger, logger, shouldLog } from "./logger";
import { telemetry } from "./telemetry";

describe("logger", () => {
  const originalLogLevel = process.env.LOG_LEVEL;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalLogLevel !== undefined) {
      process.env.LOG_LEVEL = originalLogLevel;
    } else {
      delete process.env.LOG_LEVEL;
    }
  });

  describe("createScopedLogger", () => {
    it.each(["debug", "info", "warn", "error"] as const)("prefixes %s and preserves payloads", (level) => {
      const spy = vi.spyOn(logger, level).mockImplementation(() => {});
      const payload = { requestId: "1234abcd" };
      const error = new Error("failure");
      createScopedLogger("POST /api/example req=1234abcd")[level]("Contexto", payload, error);
      expect(spy).toHaveBeenCalledWith("[POST /api/example req=1234abcd]", "Contexto", payload, error);
    });
  });

  describe("LOG_LEVEL filtering", () => {
    it("con LOG_LEVEL=warn solo permite warn y error", () => {
      process.env.LOG_LEVEL = "warn";
      expect(shouldLog("debug")).toBe(false);
      expect(shouldLog("info")).toBe(false);
      expect(shouldLog("warn")).toBe(true);
      expect(shouldLog("error")).toBe(true);
    });

    it("con LOG_LEVEL=debug permite todos los niveles", () => {
      process.env.LOG_LEVEL = "debug";
      expect(shouldLog("debug")).toBe(true);
      expect(shouldLog("info")).toBe(true);
      expect(shouldLog("warn")).toBe(true);
      expect(shouldLog("error")).toBe(true);
    });

    it("con LOG_LEVEL=error solo permite error", () => {
      process.env.LOG_LEVEL = "error";
      expect(shouldLog("debug")).toBe(false);
      expect(shouldLog("info")).toBe(false);
      expect(shouldLog("warn")).toBe(false);
      expect(shouldLog("error")).toBe(true);
    });

    it("con LOG_LEVEL=none no permite ningún log", () => {
      process.env.LOG_LEVEL = "none";
      expect(shouldLog("debug")).toBe(false);
      expect(shouldLog("info")).toBe(false);
      expect(shouldLog("warn")).toBe(false);
      expect(shouldLog("error")).toBe(false);
    });
  });

  describe("sanitization and telemetry forwarding", () => {
    it("sanitiza credenciales y PII en llamadas a info y las envía a telemetría", () => {
      process.env.LOG_LEVEL = "info";
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const telemetryLogSpy = vi.spyOn(telemetry, "log").mockImplementation(() => {});

      logger.info("Usuario autenticado exitosamente", {
        userId: "usr-99",
        password: "superPassword!",
        token: "Bearer eyJhbGciOi...",
        email: "matias@taller.com",
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "[INFO]",
        "Usuario autenticado exitosamente",
        {
          userId: "usr-99",
          password: "[REDACTED]",
          token: "[REDACTED]",
          email: "[REDACTED]",
        },
      );

      expect(telemetryLogSpy).toHaveBeenCalledWith(
        "info",
        "Usuario autenticado exitosamente",
        {
          userId: "usr-99",
          password: "[REDACTED]",
          token: "[REDACTED]",
          email: "[REDACTED]",
        },
      );
    });

    it("sanitiza mensajes de error y propiedades adicionales en llamadas a error", () => {
      process.env.LOG_LEVEL = "error";
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const telemetryErrorSpy = vi.spyOn(telemetry, "recordException").mockImplementation(() => {});
      const telemetryLogSpy = vi.spyOn(telemetry, "log").mockImplementation(() => {});

      const sensitiveErr = new Error("Falló conexión con postgres://admin:secret123@host:5432/db");
      logger.error("Error en base de datos", { token: "token_xyz" }, sensitiveErr);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(telemetryErrorSpy).toHaveBeenCalledWith(
        sensitiveErr,
        expect.objectContaining({ token: "[REDACTED]" }),
      );
      expect(sensitiveErr.message).toBe("Falló conexión con postgres://admin:[REDACTED]@host:5432/db");
      expect(telemetryLogSpy).toHaveBeenCalledWith(
        "error",
        "Error en base de datos",
        expect.objectContaining({ token: "[REDACTED]" }),
      );
    });
  });
});

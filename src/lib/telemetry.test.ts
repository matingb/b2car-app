import { describe, expect, it, vi, beforeEach } from "vitest";
import { telemetry } from "./telemetry";
import { logger } from "./logger";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { datadogRum } from "@datadog/browser-rum";

vi.mock("@datadog/browser-rum", () => ({
  datadogRum: {
    init: vi.fn(),
    getInitConfiguration: vi.fn(),
    setUser: vi.fn(),
    setAccount: vi.fn(),
    clearUser: vi.fn(),
    clearAccount: vi.fn(),
    addAction: vi.fn(),
    addError: vi.fn(),
  },
}));

vi.mock("@opentelemetry/api", async () => {
  const actual = await vi.importActual<typeof import("@opentelemetry/api")>("@opentelemetry/api");
  return {
    ...actual,
    trace: {
      ...actual.trace,
      getActiveSpan: vi.fn(),
      getTracer: vi.fn(),
    },
  };
});

describe("telemetry unified wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("wrapper provider management", () => {
    it("incluye por defecto los providers de datadog y honeycomb", () => {
      const providers = telemetry.getProviders();
      const names = providers.map((p) => p.name);
      expect(names).toContain("datadog");
      expect(names).toContain("honeycomb");
    });

    it("permite registrar un provider personalizado y despachar llamadas a él", () => {
      const customProvider = {
        name: "custom-test-provider",
        setUser: vi.fn(),
        trackAction: vi.fn(),
        recordException: vi.fn(),
      };
      telemetry.registerProvider(customProvider);

      telemetry.setUser({ id: "usr-custom" });
      expect(customProvider.setUser).toHaveBeenCalledWith({ id: "usr-custom" });

      telemetry.trackAction("custom_action");
      expect(customProvider.trackAction).toHaveBeenCalledWith("custom_action", undefined);

      const testErr = new Error("custom error");
      telemetry.recordException(testErr);
      expect(customProvider.recordException).toHaveBeenCalledWith(testErr, undefined);

      telemetry.removeProvider("custom-test-provider");
    });

    it("permite invocar initClient e initServer en todos los providers registrados", async () => {
      const customProvider = {
        name: "custom-init-provider",
        initClient: vi.fn(),
        initServer: vi.fn(),
      };
      telemetry.registerProvider(customProvider);

      await telemetry.initClient();
      expect(customProvider.initClient).toHaveBeenCalled();

      await telemetry.initServer();
      expect(customProvider.initServer).toHaveBeenCalled();

      telemetry.removeProvider("custom-init-provider");
    });
  });

  describe("setUser", () => {
    it("mapea los datos a Datadog RUM y Honeycomb/OTel active span", () => {
      const mockSpan = {
        setAttribute: vi.fn(),
        setAttributes: vi.fn(),
      };
      vi.mocked(trace.getActiveSpan).mockReturnValue(mockSpan as unknown as ReturnType<typeof trace.getActiveSpan>);

      telemetry.setUser({
        id: "usr-123",
        name: "Matias",
        email: "matias@example.com",
        plan_sub: "PRO",
        tenant_id: "tenant-456",
        tenant_name: "Taller Matias",
      });

      // Datadog RUM
      expect(datadogRum.setUser).toHaveBeenCalledWith({
        id: "usr-123",
        name: "Matias",
        email: "matias@example.com",
        plan_sub: "PRO",
      });

      // Honeycomb / OTel Span
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("user.id", "usr-123");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("tenant_id", "tenant-456");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("tenant_name", "Taller Matias");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("plan_sub", "PRO");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("user.email", "matias@example.com");
    });

    it("no hace nada si user es nulo o no tiene id", () => {
      // @ts-expect-error testing invalid payload
      telemetry.setUser(null);
      expect(datadogRum.setUser).not.toHaveBeenCalled();
    });
  });

  describe("identify", () => {
    it("asocia user y account en Datadog RUM y OpenTelemetry", () => {
      const mockSpan = {
        setAttribute: vi.fn(),
      };
      vi.mocked(trace.getActiveSpan).mockReturnValue(mockSpan as unknown as ReturnType<typeof trace.getActiveSpan>);

      telemetry.identify({
        user: { id: "u-1", role: "admin", email: "admin@test.com" },
        account: { id: "t-1", name: "Taller Alfa", plan: "PRO" },
      });

      expect(datadogRum.setUser).toHaveBeenCalledWith({
        id: "u-1",
        role: "admin",
        email: "admin@test.com",
      });
      expect(datadogRum.setAccount).toHaveBeenCalledWith({
        id: "t-1",
        name: "Taller Alfa",
        plan: "PRO",
      });

      expect(mockSpan.setAttribute).toHaveBeenCalledWith("user.id", "u-1");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("user.role", "admin");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("user.email", "admin@test.com");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("account.id", "t-1");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("tenant_id", "t-1");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("account.name", "Taller Alfa");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("tenant_name", "Taller Alfa");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("account.plan", "PRO");
    });
  });

  describe("identityFromClaims", () => {
    it("extrae identidad estructurada separando user y account", async () => {
      const { identityFromClaims } = await import("./telemetry");
      const identity = identityFromClaims({
        sub: "user-uuid",
        user_role: "operativo",
        email: "op@taller.com",
        tenant_id: "tenant-uuid",
        tenant_name: "Taller Beta",
        plan_sub: "BASE",
      });

      expect(identity).toEqual({
        user: {
          id: "user-uuid",
          role: "operativo",
          email: "op@taller.com",
        },
        account: {
          id: "tenant-uuid",
          name: "Taller Beta",
          plan: "BASE",
        },
      });
    });

    it("retorna null si claims no tiene sub", async () => {
      const { identityFromClaims } = await import("./telemetry");
      expect(identityFromClaims(null)).toBeNull();
      expect(identityFromClaims({})).toBeNull();
    });
  });

  describe("clearUser", () => {
    it("limpia el usuario y la cuenta en Datadog RUM", () => {
      telemetry.clearUser();
      expect(datadogRum.clearUser).toHaveBeenCalled();
      expect(datadogRum.clearAccount).toHaveBeenCalled();
    });
  });

  describe("trackAction", () => {
    it("envía la acción a Datadog RUM y como evento al span de OpenTelemetry", () => {
      const mockSpan = {
        addEvent: vi.fn(),
      };
      vi.mocked(trace.getActiveSpan).mockReturnValue(mockSpan as unknown as ReturnType<typeof trace.getActiveSpan>);

      telemetry.trackAction("crear_factura", { facturaId: "f-1", total: 1500 });

      expect(datadogRum.addAction).toHaveBeenCalledWith("crear_factura", { facturaId: "f-1", total: 1500 });
      expect(mockSpan.addEvent).toHaveBeenCalledWith("crear_factura", { facturaId: "f-1", total: 1500 });
    });
  });

  describe("recordException", () => {
    it("registra la excepción en Datadog RUM y OpenTelemetry con status ERROR", () => {
      const mockSpan = {
        recordException: vi.fn(),
        setStatus: vi.fn(),
        setAttribute: vi.fn(),
      };
      vi.mocked(trace.getActiveSpan).mockReturnValue(mockSpan as unknown as ReturnType<typeof trace.getActiveSpan>);

      const error = new Error("Fallo en cálculo");
      telemetry.recordException(error, { modulo: "finanzas" });

      expect(datadogRum.addError).toHaveBeenCalledWith(error, { modulo: "finanzas" });
      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: "Fallo en cálculo",
      });
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("error.context.modulo", "finanzas");
    });
  });

  describe("logger integration", () => {
    it("logger.error reenvía automáticamente el error y contexto a telemetry", () => {
      const mockSpan = {
        recordException: vi.fn(),
        setStatus: vi.fn(),
        setAttribute: vi.fn(),
      };
      vi.mocked(trace.getActiveSpan).mockReturnValue(mockSpan as unknown as ReturnType<typeof trace.getActiveSpan>);

      const err = new Error("DB Connection Timeout");
      logger.error("Operación fallida", { retryCount: 3 }, err);

      expect(datadogRum.addError).toHaveBeenCalled();
      expect(mockSpan.recordException).toHaveBeenCalledWith(err);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: "DB Connection Timeout",
      });
    });
  });
});

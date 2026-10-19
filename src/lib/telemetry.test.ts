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
    it("dado un operador, al iniciar sesión, se asocian todas las trazas y métricas al taller y a su plan comercial", () => {
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
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("user.email", "matias@example.com");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("tenant.id", "tenant-456");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("tenant.name", "Taller Matias");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("tenant.plan", "PRO");
    });

    it("dado un usuario anónimo o sin identificador, no asocia datos de taller ni usuario", () => {
      // @ts-expect-error testing invalid payload
      telemetry.setUser(null);
      expect(datadogRum.setUser).not.toHaveBeenCalled();
    });
  });

  describe("identify", () => {
    it("dado un operador con rol y taller definido, al identificarse, asocia el contexto completo del taller a la traza activa", () => {
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
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("tenant.id", "t-1");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("tenant.name", "Taller Alfa");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("tenant.plan", "PRO");
    });
  });

  describe("identityFromClaims", () => {
    it("dadas las credenciales en el token de sesión, extrae el rol del operador y los datos del taller", async () => {
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

    it("dadas credenciales sin usuario, no genera contexto de identidad", async () => {
      const { identityFromClaims } = await import("./telemetry");
      expect(identityFromClaims(null)).toBeNull();
      expect(identityFromClaims({})).toBeNull();
    });
  });

  describe("clearUser", () => {
    it("dado un operador, al cerrar sesión, se desvincula al usuario y al taller", () => {
      telemetry.clearUser();
      expect(datadogRum.clearUser).toHaveBeenCalled();
      expect(datadogRum.clearAccount).toHaveBeenCalled();
    });
  });

  describe("trackAction", () => {
    it("dada una acción comercial como emitir una factura, registra el evento con su contexto en la traza activa", () => {
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
    it("dada una falla en una operación del taller, reporta el incidente marcando la traza con error y su contexto", () => {
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

  describe("log", () => {
    it("dado un log estructurado, lo propaga como evento a Honeycomb y acción a Datadog", () => {
      const mockSpan = {
        addEvent: vi.fn(),
      };
      vi.mocked(trace.getActiveSpan).mockReturnValue(mockSpan as unknown as ReturnType<typeof trace.getActiveSpan>);

      telemetry.log("warn", "Consumo alto de recursos", { memoriaMb: 512 });

      expect(datadogRum.addAction).toHaveBeenCalledWith("Consumo alto de recursos", {
        memoriaMb: 512,
      });
      expect(mockSpan.addEvent).toHaveBeenCalledWith("Consumo alto de recursos", {
        memoriaMb: 512,
      });
    });
  });

  describe("logger integration", () => {
    it("dado un error registrado en el log del sistema, lo propaga automáticamente a telemetría", () => {
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

  describe("Generic Trace Attribute Store and Root Enrichment", () => {
    it("dado un operador identificado en el sistema, registra automáticamente el taller y usuario en el contexto de la traza activa", async () => {
      const { traceAttributeStore } = await import("./telemetry/store");
      const mockSpan = {
        spanContext: () => ({ traceId: "trace-identify-1", spanId: "span-id-1" }),
        setAttribute: vi.fn(),
      };
      vi.mocked(trace.getActiveSpan).mockReturnValue(mockSpan as unknown as ReturnType<typeof trace.getActiveSpan>);

      telemetry.identify({
        user: { id: "u-active", email: "active@b2car.com" },
        account: { id: "t-active", name: "Taller Activo", plan: "PRO" },
      });

      expect(traceAttributeStore.get("trace-identify-1")).toEqual({
        "user.id": "u-active",
        "user.email": "active@b2car.com",
        "tenant.id": "t-active",
        "tenant.name": "Taller Activo",
        "tenant.plan": "PRO",
      });

      traceAttributeStore.delete("trace-identify-1");
    });

    it("dada una operación en la plataforma, al finalizar la solicitud, asegura que la traza principal contenga el taller y el plan para permitir análisis y filtros globales", async () => {
      const { TraceAttributeStore, RootEnrichmentSpanProcessor } = await import("./telemetry/honeycomb");
      const store = new TraceAttributeStore(60_000);
      const processor = new RootEnrichmentSpanProcessor(store);

      store.set("trace-root-1", {
        "tenant.id": "t-100",
        "tenant.name": "Taller Central",
        "tenant.plan": "PRO",
      });

      const rootSpan = {
        spanContext: () => ({ traceId: "trace-root-1", spanId: "span-1" }),
        parentSpanContext: undefined,
        attributes: { "http.method": "GET" } as Record<string, unknown>,
      };

      // @ts-expect-error readable span mock
      processor.onEnd(rootSpan);

      expect(rootSpan.attributes["tenant.id"]).toBe("t-100");
      expect(rootSpan.attributes["tenant.name"]).toBe("Taller Central");
      expect(rootSpan.attributes["tenant.plan"]).toBe("PRO");
      expect(rootSpan.attributes["http.method"]).toBe("GET");

      // La memoria del trace se libera tras finalizar el root
      expect(store.get("trace-root-1")).toBeUndefined();
    });

    it("dada una operación en curso, cuando se inician tareas secundarias, propaga el contexto a todas las subtareas", async () => {
      const { TraceAttributeStore, RootEnrichmentSpanProcessor } = await import("./telemetry/honeycomb");
      const store = new TraceAttributeStore(60_000);
      const processor = new RootEnrichmentSpanProcessor(store);

      store.set("trace-child-1", { "tenant.id": "t-child" });

      const childSpan = {
        spanContext: () => ({ traceId: "trace-child-1", spanId: "child-span-1" }),
        setAttribute: vi.fn(),
      };

      // @ts-expect-error span mock
      processor.onStart(childSpan, {} as never);

      expect(childSpan.setAttribute).toHaveBeenCalledWith("tenant.id", "t-child");
    });
  });
});

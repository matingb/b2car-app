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
        setAttributes: vi.fn(),
      };
      vi.mocked(trace.getActiveSpan).mockReturnValue(mockSpan as unknown as ReturnType<typeof trace.getActiveSpan>);

      telemetry.log("warn", "Consumo alto de recursos", { memoriaMb: 512 });

      expect(datadogRum.addAction).toHaveBeenCalledWith("Consumo alto de recursos", {
        severity: "warn",
        memoriaMb: 512,
      });
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        severity: "warn",
        memoriaMb: 512,
      });
      expect(mockSpan.addEvent).toHaveBeenCalledWith("Consumo alto de recursos", {
        severity: "warn",
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
        setAttributes: vi.fn(),
        addEvent: vi.fn(),
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

  describe("Honeycomb Native Span Attributes", () => {
    it("dado un operador identificado en el sistema, registra automáticamente el taller y usuario en los atributos del span activo", () => {
      const mockSpan = {
        spanContext: () => ({ traceId: "trace-identify-1", spanId: "span-id-1" }),
        setAttribute: vi.fn(),
      };
      vi.mocked(trace.getActiveSpan).mockReturnValue(mockSpan as unknown as ReturnType<typeof trace.getActiveSpan>);

      telemetry.identify({
        user: { id: "u-active", email: "active@b2car.com" },
        account: { id: "t-active", name: "Taller Activo", plan: "PRO" },
      });

      expect(mockSpan.setAttribute).toHaveBeenCalledWith("user.id", "u-active");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("user.email", "active@b2car.com");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("tenant.id", "t-active");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("tenant.name", "Taller Activo");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("tenant.plan", "PRO");
    });

    it("HoneycombNativeSpanProcessor inyecta automáticamente atributos de Baggage en cualquier span que inicia", async () => {
      const { HoneycombNativeSpanProcessor } = await import("./telemetry");
      const { propagation, context } = await import("@opentelemetry/api");

      const processor = new HoneycombNativeSpanProcessor();
      const mockChildSpan = {
        setAttribute: vi.fn(),
      };

      const bg = propagation.createBaggage({
        "user.id": { value: "usr-bg-99" },
        "tenant.id": { value: "tenant-bg-42" },
        "secret.token": { value: "should-be-filtered" },
      });
      const parentCtx = propagation.setBaggage(context.active(), bg);

      processor.onStart(mockChildSpan as unknown as Parameters<typeof processor.onStart>[0], parentCtx);

      expect(mockChildSpan.setAttribute).toHaveBeenCalledWith("user.id", "usr-bg-99");
      expect(mockChildSpan.setAttribute).toHaveBeenCalledWith("tenant.id", "tenant-bg-42");
      expect(mockChildSpan.setAttribute).not.toHaveBeenCalledWith("secret.token", expect.anything());
    });

    it("HoneycombNativeSpanProcessor inyecta la identidad activa actual en cualquier nuevo span", async () => {
      const { HoneycombNativeSpanProcessor, setActiveIdentity, clearActiveIdentity } = await import("./telemetry");
      const { context } = await import("@opentelemetry/api");

      setActiveIdentity({
        "user.id": "usr-stored",
        "tenant.id": "tenant-stored",
        "user.role": "admin",
      });

      const processor = new HoneycombNativeSpanProcessor();
      const mockSpan = {
        setAttribute: vi.fn(),
      };

      processor.onStart(mockSpan as unknown as Parameters<typeof processor.onStart>[0], context.active());

      expect(mockSpan.setAttribute).toHaveBeenCalledWith("user.id", "usr-stored");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("tenant.id", "tenant-stored");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("user.role", "admin");

      clearActiveIdentity();
    });

    it("telemetry.withIdentity propaga la identidad a través de llamadas asíncronas", async () => {
      const { HoneycombNativeSpanProcessor, clearActiveIdentity } = await import("./telemetry");
      const { context } = await import("@opentelemetry/api");

      clearActiveIdentity();
      const processor = new HoneycombNativeSpanProcessor();

      await telemetry.withIdentity(
        {
          user: { id: "u-with-ctx", email: "with@ctx.com", role: "mecanico" },
          account: { id: "t-with-ctx", name: "Taller Context", plan: "ENTERPRISE" },
        },
        async () => {
          const mockInnerSpan = {
            setAttribute: vi.fn(),
          };
          processor.onStart(mockInnerSpan as unknown as Parameters<typeof processor.onStart>[0], context.active());

          expect(mockInnerSpan.setAttribute).toHaveBeenCalledWith("user.id", "u-with-ctx");
          expect(mockInnerSpan.setAttribute).toHaveBeenCalledWith("user.email", "with@ctx.com");
          expect(mockInnerSpan.setAttribute).toHaveBeenCalledWith("user.role", "mecanico");
          expect(mockInnerSpan.setAttribute).toHaveBeenCalledWith("tenant.id", "t-with-ctx");
          expect(mockInnerSpan.setAttribute).toHaveBeenCalledWith("tenant.name", "Taller Context");
          expect(mockInnerSpan.setAttribute).toHaveBeenCalledWith("tenant.plan", "ENTERPRISE");
        }
      );
    });

    it("telemetry.clearUser elimina la identidad activa para spans posteriores", async () => {
      const { HoneycombNativeSpanProcessor, getActiveIdentityAttributes } = await import("./telemetry");
      const { context } = await import("@opentelemetry/api");

      telemetry.identify({
        user: { id: "u-logout" },
        account: { id: "t-logout" },
      });

      telemetry.clearUser();

      const attrs = getActiveIdentityAttributes();
      expect(attrs).toBeNull();

      const processor = new HoneycombNativeSpanProcessor();
      const mockSpan = {
        setAttribute: vi.fn(),
      };
      processor.onStart(mockSpan as unknown as Parameters<typeof processor.onStart>[0], context.active());
      expect(mockSpan.setAttribute).not.toHaveBeenCalledWith("user.id", "u-logout");
    });

    it("extractClaimsFromCookieHeader decodifica correctamente tokens de sesión de cookies de Supabase", async () => {
      const { extractClaimsFromCookieHeader } = await import("./telemetry");

      const testPayload = {
        sub: "usr-cookie-1",
        email: "cookie@user.com",
        tenant_id: "tenant-cookie-1",
        tenant_name: "Taller Cookie",
        user_role: "admin",
        plan_sub: "PRO",
      };

      const dummyJwt = "header." + Buffer.from(JSON.stringify(testPayload)).toString("base64url") + ".sig";
      const dummyCookie = "sb-projectref-auth-token=base64-" + Buffer.from(JSON.stringify({ access_token: dummyJwt })).toString("base64url");

      const extracted = extractClaimsFromCookieHeader(dummyCookie);
      expect(extracted).toEqual(testPayload);
    });

    it("extractClaimsFromCookieHeader decodifica tokens fragmentados en múltiples cookies", async () => {
      const { extractClaimsFromCookieHeader } = await import("./telemetry");

      const testPayload = { sub: "usr-chunked", email: "chunk@test.com" };
      const dummyJwt = "header." + Buffer.from(JSON.stringify(testPayload)).toString("base64url") + ".sig";
      const fullBase64 = "base64-" + Buffer.from(JSON.stringify({ access_token: dummyJwt })).toString("base64url");
      const mid = Math.floor(fullBase64.length / 2);
      const cookieHeader = `sb-ref-auth-token.0=${fullBase64.slice(0, mid)}; sb-ref-auth-token.1=${fullBase64.slice(mid)}`;

      const extracted = extractClaimsFromCookieHeader(cookieHeader);
      expect(extracted).toEqual(testPayload);
    });

    it("enrichSpan asigna atributos de forma segura al span", async () => {
      const { enrichSpan } = await import("./telemetry");
      const mockSpan = { setAttribute: vi.fn() };

      enrichSpan(mockSpan as never, { "user.id": "u-enrich", "tenant.id": "t-enrich" });

      expect(mockSpan.setAttribute).toHaveBeenCalledWith("user.id", "u-enrich");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("tenant.id", "t-enrich");
    });

    it("HoneycombNativeSpanProcessor enriquece en onEnd los spans que iniciaron antes de conocer la identidad", async () => {
      const { HoneycombNativeSpanProcessor, setActiveIdentity, clearActiveIdentity } = await import("./telemetry");

      clearActiveIdentity();
      const processor = new HoneycombNativeSpanProcessor();

      const earlySpan = {
        attributes: {} as Record<string, unknown>,
        setAttribute: vi.fn(),
      };

      setActiveIdentity({
        "tenant.id": "tenant-late",
        "user.id": "usr-late",
      });

      processor.onEnd(earlySpan as unknown as Parameters<typeof processor.onEnd>[0]);

      expect(earlySpan.attributes["tenant.id"]).toBe("tenant-late");
      expect(earlySpan.attributes["user.id"]).toBe("usr-late");

      clearActiveIdentity();
    });
  });
});

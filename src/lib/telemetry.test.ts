import { describe, expect, it, vi, beforeEach } from "vitest";
import { telemetry, getActiveIdentityAttributes } from "./telemetry";
import { logger } from "./logger";
import { trace, SpanStatusCode } from "@opentelemetry/api";

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
    it("incluye por defecto únicamente el provider de honeycomb", () => {
      const providers = telemetry.getProviders();
      const names = providers.map((p) => p.name);
      expect(names).toEqual(["honeycomb"]);
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

      // Honeycomb / OTel Span
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("user.id", "usr-123");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("user.email", "matias@example.com");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("tenant.id", "tenant-456");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("tenant.name", "Taller Matias");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("tenant.plan", "PRO");
    });

    it("dado un usuario anónimo o sin identificador, no asocia datos de taller ni usuario", () => {
      const mockSpan = {
        setAttribute: vi.fn(),
      };
      vi.mocked(trace.getActiveSpan).mockReturnValue(mockSpan as unknown as ReturnType<typeof trace.getActiveSpan>);

      // @ts-expect-error testing invalid payload
      telemetry.setUser(null);
      expect(mockSpan.setAttribute).not.toHaveBeenCalled();
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

    it("dadas credenciales con user_metadata.full_name o name, omite user.name y user.full_name por el momento", async () => {
      const { identityFromClaims, getTelemetryAttributes } = await import("./telemetry");
      const identity = identityFromClaims({
        sub: "user-uuid",
        email: "op@taller.com",
        user_role: "admin",
        user_name: "op",
        name: "Operador",
        user_metadata: {
          full_name: "Operador Completo",
          name: "Operador Meta",
        },
        tenant_id: "tenant-uuid",
      });

      expect(identity).toEqual({
        user: {
          id: "user-uuid",
          role: "admin",
          email: "op@taller.com",
        },
        account: {
          id: "tenant-uuid",
        },
      });
      const attrs = getTelemetryAttributes(identity!);
      expect(attrs["user.name"]).toBeUndefined();
      expect(attrs["user.full_name"]).toBeUndefined();
    });

    it("dadas credenciales sin usuario, no genera contexto de identidad", async () => {
      const { identityFromClaims } = await import("./telemetry");
      expect(identityFromClaims(null)).toBeNull();
      expect(identityFromClaims({})).toBeNull();
    });
  });

  describe("clearUser", () => {
    it("dado un operador, al cerrar sesión, se desvincula al usuario y al taller", () => {
      telemetry.identify({
        user: { id: "u-1" },
        account: { id: "t-1", name: "Taller Alfa" },
      });
      expect(getActiveIdentityAttributes()).not.toBeNull();

      telemetry.clearUser();
      expect(getActiveIdentityAttributes()).toBeNull();
    });
  });

  describe("trackAction", () => {
    it("dada una acción comercial como emitir una factura, registra el evento con su contexto en la traza activa", () => {
      const mockSpan = {
        addEvent: vi.fn(),
      };
      vi.mocked(trace.getActiveSpan).mockReturnValue(mockSpan as unknown as ReturnType<typeof trace.getActiveSpan>);

      telemetry.trackAction("crear_factura", { facturaId: "f-1", total: 1500 });

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

      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: "Fallo en cálculo",
      });
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("error.context.modulo", "finanzas");
    });
  });

  describe("log", () => {
    it("dado un log estructurado, lo propaga como evento de span y LogRecord sin mutar los atributos del span padre", async () => {
      const { logs } = await import("./telemetry");
      const emitMock = vi.fn();
      const getLoggerSpy = vi.spyOn(logs, "getLogger").mockReturnValue({ emit: emitMock } as never);

      const mockSpan = {
        addEvent: vi.fn(),
        setAttributes: vi.fn(),
      };
      vi.mocked(trace.getActiveSpan).mockReturnValue(mockSpan as unknown as ReturnType<typeof trace.getActiveSpan>);

      telemetry.log("warn", "Consumo alto de recursos", { memoriaMb: 512 });

      expect(mockSpan.setAttributes).not.toHaveBeenCalled();
      expect(mockSpan.addEvent).toHaveBeenCalledWith("Consumo alto de recursos", {
        severity: "warn",
        memoriaMb: 512,
      });
      expect(getLoggerSpy).toHaveBeenCalledWith("b2car-app");
      expect(emitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          severityText: "WARN",
          body: "Consumo alto de recursos",
          attributes: {
            severity: "warn",
            memoriaMb: 512,
          },
        }),
      );
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
      const { extractClaimsFromCookieHeader } = await import("./telemetry/honeycomb");

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
      const { extractClaimsFromCookieHeader } = await import("./telemetry/honeycomb");

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

    it("HoneycombNativeSpanProcessor enriquece en onEnding via setAttribute los spans que iniciaron antes de conocer la identidad y no muta ReadableSpan en onEnd", async () => {
      const { HoneycombNativeSpanProcessor, setActiveIdentity, clearActiveIdentity } = await import("./telemetry");

      clearActiveIdentity();
      const processor = new HoneycombNativeSpanProcessor();

      const earlySpan = {
        attributes: {} as Record<string, unknown>,
        setAttribute: vi.fn((k: string, v: unknown) => {
          earlySpan.attributes[k] = v;
        }),
      };

      setActiveIdentity({
        "tenant.id": "tenant-late",
        "user.id": "usr-late",
      });

      processor.onEnding?.(earlySpan as unknown as Parameters<NonNullable<typeof processor.onEnding>>[0]);

      expect(earlySpan.setAttribute).toHaveBeenCalledWith("tenant.id", "tenant-late");
      expect(earlySpan.setAttribute).toHaveBeenCalledWith("user.id", "usr-late");

      const finishedSpan = {
        attributes: {} as Record<string, unknown>,
      };
      const asSpanProcessor: import("@opentelemetry/sdk-trace-base").SpanProcessor = processor;
      asSpanProcessor.onEnd(finishedSpan as unknown as import("@opentelemetry/sdk-trace-base").ReadableSpan);
      expect(finishedSpan.attributes).toEqual({});

      clearActiveIdentity();
    });

    it("propaga user.* y tenant.* (incluyendo tenant.name) al span raíz del trace aunque identify se llame en un span hijo", async () => {
      const { HoneycombNativeSpanProcessor, clearActiveIdentity } = await import("./telemetry");
      const { context } = await import("@opentelemetry/api");

      clearActiveIdentity();
      const processor = new HoneycombNativeSpanProcessor();
      const traceId = "4bf92f3577b34da6a3ce929d0e0e4736";

      const rootSpan = {
        spanContext: () => ({ traceId, spanId: "00f067aa0ba902b7" }),
        attributes: {} as Record<string, unknown>,
        setAttribute: vi.fn((k: string, v: unknown) => {
          rootSpan.attributes[k] = v;
        }),
      };

      // El span raíz inicia antes de que el handler autentique al usuario
      processor.onStart(rootSpan as unknown as Parameters<typeof processor.onStart>[0], context.active());
      expect(rootSpan.attributes["tenant.id"]).toBeUndefined();

      // Un span hijo (por ejemplo, handler de API o createClient) identifica al usuario y tenant
      const childSpan = {
        spanContext: () => ({ traceId, spanId: "11f067aa0ba902b8" }),
        attributes: {} as Record<string, unknown>,
        setAttribute: vi.fn((k: string, v: unknown) => {
          childSpan.attributes[k] = v;
        }),
      };
      vi.mocked(trace.getActiveSpan).mockReturnValue(childSpan as unknown as ReturnType<typeof trace.getActiveSpan>);

      telemetry.identify({
        user: { id: "u-root-test", email: "user@taller.com", role: "admin" },
        account: { id: "t-root-test", name: "Neumáticos Arturo", plan: "PRO" },
      });

      // Un span nieto (por ejemplo, fetch/undici) que inicia dentro del mismo trace recibe todo en onStart
      const grandchildSpan = {
        spanContext: () => ({ traceId, spanId: "22f067aa0ba902b9" }),
        attributes: {} as Record<string, unknown>,
        setAttribute: vi.fn((k: string, v: unknown) => {
          grandchildSpan.attributes[k] = v;
        }),
      };
      processor.onStart(grandchildSpan as unknown as Parameters<typeof processor.onStart>[0], context.active());
      expect(grandchildSpan.attributes).toMatchObject({
        "user.id": "u-root-test",
        "user.email": "user@taller.com",
        "user.role": "admin",
        "tenant.id": "t-root-test",
        "tenant.name": "Neumáticos Arturo",
        "tenant.plan": "PRO",
      });

      // Al finalizar el span raíz, onEnding completa todos los atributos vía setAttribute
      processor.onEnding?.(rootSpan as unknown as Parameters<NonNullable<typeof processor.onEnding>>[0]);
      expect(rootSpan.attributes).toMatchObject({
        "user.id": "u-root-test",
        "user.email": "user@taller.com",
        "user.role": "admin",
        "tenant.id": "t-root-test",
        "tenant.name": "Neumáticos Arturo",
        "tenant.plan": "PRO",
      });

      clearActiveIdentity();
    });

    it("no expone PII (user.email) en W3C Baggage aunque conserva la identidad completa en Context", async () => {
      const { ALLOWED_BAGGAGE_KEYS, clearActiveIdentity } = await import("./telemetry");
      const { context, propagation } = await import("@opentelemetry/api");
      const { StackContextManager } = await import("@opentelemetry/sdk-trace-web");

      const ctxManager = new StackContextManager();
      ctxManager.enable();
      context.setGlobalContextManager(ctxManager);

      try {
        clearActiveIdentity();
        expect(ALLOWED_BAGGAGE_KEYS.has("user.email")).toBe(false);
        expect(ALLOWED_BAGGAGE_KEYS.has("user.name")).toBe(false);
        expect(ALLOWED_BAGGAGE_KEYS.has("user.full_name")).toBe(false);

        await telemetry.withIdentity(
          {
            user: { id: "u-pii", email: "privado@taller.com", role: "admin" },
            account: { id: "t-pii", name: "Taller Seguro", plan: "PRO" },
          },
          () => {
            const activeBaggage = propagation.getActiveBaggage();
            expect(activeBaggage?.getEntry("user.id")?.value).toBe("u-pii");
            expect(activeBaggage?.getEntry("tenant.id")?.value).toBe("t-pii");
            expect(activeBaggage?.getEntry("user.email")).toBeUndefined();
            expect(activeBaggage?.getEntry("user.name")).toBeUndefined();
            expect(activeBaggage?.getEntry("user.full_name")).toBeUndefined();

            const resolved = getActiveIdentityAttributes();
            expect(resolved).toMatchObject({
              "user.id": "u-pii",
              "user.email": "privado@taller.com",
              "tenant.id": "t-pii",
            });
            expect(resolved?.["user.name"]).toBeUndefined();
            expect(resolved?.["user.full_name"]).toBeUndefined();
          },
        );
      } finally {
        clearActiveIdentity();
        context.disable();
      }
    });

    it("aísla identidades por traceId en servidor y clearUser solo limpia la traza activa", async () => {
      const { clearActiveIdentity } = await import("./telemetry");
      vi.stubGlobal("window", undefined);

      try {
        const traceUserA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        const traceUserB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

        vi.mocked(trace.getActiveSpan).mockReturnValue({
          spanContext: () => ({ traceId: traceUserA, spanId: "1111111111111111" }),
          setAttribute: vi.fn(),
        } as unknown as ReturnType<typeof trace.getActiveSpan>);
        telemetry.identify({
          user: { id: "user-a", email: "a@test.com" },
          account: { id: "tenant-a" },
        });

        vi.mocked(trace.getActiveSpan).mockReturnValue({
          spanContext: () => ({ traceId: traceUserB, spanId: "2222222222222222" }),
          setAttribute: vi.fn(),
        } as unknown as ReturnType<typeof trace.getActiveSpan>);
        telemetry.identify({
          user: { id: "user-b", email: "b@test.com" },
          account: { id: "tenant-b" },
        });

        // Sin traza activa en servidor, no se filtra identidad de otro usuario
        vi.mocked(trace.getActiveSpan).mockReturnValue(undefined);
        expect(getActiveIdentityAttributes()).toBeNull();

        // Logout del Usuario A solo elimina traceUserA, manteniendo traceUserB intacto
        vi.mocked(trace.getActiveSpan).mockReturnValue({
          spanContext: () => ({ traceId: traceUserA, spanId: "1111111111111111" }),
        } as unknown as ReturnType<typeof trace.getActiveSpan>);
        telemetry.clearUser();

        expect(getActiveIdentityAttributes(undefined, traceUserA)).toBeNull();
        expect(getActiveIdentityAttributes(undefined, traceUserB)).toMatchObject({
          "user.id": "user-b",
          "tenant.id": "tenant-b",
        });
      } finally {
        vi.unstubAllGlobals();
        clearActiveIdentity();
      }
    });

    it("extractClaimsFromCookieHeader ordena numéricamente cookies fragmentadas en 10 o más partes", async () => {
      const { extractClaimsFromCookieHeader } = await import("./telemetry/honeycomb");

      const testPayload = { sub: "usr-many-chunks", email: "chunks@test.com" };
      const dummyJwt = "header." + Buffer.from(JSON.stringify(testPayload)).toString("base64url") + ".sig";
      const fullBase64 = "base64-" + Buffer.from(JSON.stringify({ access_token: dummyJwt })).toString("base64url");
      const chunkSize = Math.ceil(fullBase64.length / 11);
      const chunks: string[] = [];
      for (let i = 0; i * chunkSize < fullBase64.length; i++) {
        chunks.push(`sb-ref-auth-token.${i}=${fullBase64.slice(i * chunkSize, (i + 1) * chunkSize)}`);
      }
      // Desordenar poniendo el chunk 10 antes del 2
      const cookieHeader = chunks.reverse().join("; ");

      const extracted = extractClaimsFromCookieHeader(cookieHeader);
      expect(extracted).toEqual(testPayload);
    });

    it("telemetry.trace marca error y registra excepción incluso cuando se lanza un valor que no es Error", async () => {
      const mockSpan = {
        recordException: vi.fn(),
        setStatus: vi.fn(),
        end: vi.fn(),
      };
      vi.mocked(trace.getTracer).mockReturnValue({
        startActiveSpan: (_name: string, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan),
      } as never);

      await expect(
        telemetry.trace("operacion-fallida", () => {
          throw "boom";
        }),
      ).rejects.toBe("boom");

      expect(mockSpan.recordException).toHaveBeenCalledWith(expect.any(Error));
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: "boom",
      });
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it("SupabaseCookieIdentityPropagator extrae user.* y tenant.* de la cookie de sesión antes de iniciar el span raíz", async () => {
      const { SupabaseCookieIdentityPropagator } = await import("./telemetry/honeycomb");
      const {
        HoneycombNativeSpanProcessor,
        clearActiveIdentity,
      } = await import("./telemetry");
      const { context, defaultTextMapGetter } = await import("@opentelemetry/api");

      clearActiveIdentity();
      const propagator = new SupabaseCookieIdentityPropagator();
      const processor = new HoneycombNativeSpanProcessor();

      const payload = {
        sub: "usr-prop-1",
        email: "prop@taller.com",
        user_role: "operativo",
        tenant_id: "ten-prop-1",
        tenant_name: "Evolución Automotriz",
        plan_sub: "PRO",
      };
      const jwt = "header." + Buffer.from(JSON.stringify(payload)).toString("base64url") + ".sig";
      const cookie =
        "sb-ref-auth-token=base64-" +
        Buffer.from(JSON.stringify({ access_token: jwt })).toString("base64url");

      const extractedCtx = propagator.extract(
        context.active(),
        { cookie },
        defaultTextMapGetter,
      );

      const rootSpan = {
        spanContext: () => ({ traceId: "99f92f3577b34da6a3ce929d0e0e4799", spanId: "00f067aa0ba90299" }),
        attributes: {} as Record<string, unknown>,
        setAttribute: vi.fn((k: string, v: unknown) => {
          rootSpan.attributes[k] = v;
        }),
      };

      processor.onStart(rootSpan as unknown as Parameters<typeof processor.onStart>[0], extractedCtx);

      expect(rootSpan.attributes).toMatchObject({
        "user.id": "usr-prop-1",
        "user.email": "prop@taller.com",
        "user.role": "operativo",
        "tenant.id": "ten-prop-1",
        "tenant.name": "Evolución Automotriz",
        "tenant.plan": "PRO",
      });

      clearActiveIdentity();
    });
  });
});

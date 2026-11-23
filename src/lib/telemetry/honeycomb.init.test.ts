import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("Honeycomb SDK initialization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it("initHoneycombClient configura HoneycombWebSDK con auto-instrumentations-web, serviceName, serviceVersion y HoneycombNativeSpanProcessor", async () => {
    const startMock = vi.fn();
    const honeycombSdkCtor = vi.fn(function HoneycombWebSDKMock(this: { start: typeof startMock }) {
      this.start = startMock;
    });
    const getWebAutoInstrumentationsMock = vi.fn(() => [{ name: "auto-web" }]);

    vi.doMock("@honeycombio/opentelemetry-web", () => ({
      HoneycombWebSDK: honeycombSdkCtor,
    }));
    vi.doMock("@opentelemetry/auto-instrumentations-web", () => ({
      getWebAutoInstrumentations: getWebAutoInstrumentationsMock,
    }));

    process.env.NEXT_PUBLIC_HONEYCOMB_API_KEY = "hcaik_frontend_test";
    process.env.NEXT_PUBLIC_TELEMETRY_FRONTEND_SERVICE_NAME = "b2car-web-test";
    process.env.NEXT_PUBLIC_APP_VERSION = "1.13.2";

    const { initHoneycombClient, HoneycombNativeSpanProcessor } = await import("./honeycomb");
    await initHoneycombClient();

    expect(getWebAutoInstrumentationsMock).toHaveBeenCalledWith({
      "@opentelemetry/instrumentation-fetch": {
        ignoreUrls: [/api(\.eu1)?\.honeycomb\.io/i],
      },
      "@opentelemetry/instrumentation-xml-http-request": {
        ignoreUrls: [/api(\.eu1)?\.honeycomb\.io/i],
      },
    });
    expect(honeycombSdkCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "hcaik_frontend_test",
        serviceName: "b2car-web-test",
        serviceVersion: "1.13.2",
        disableDefaultMetricExporter: true,
        instrumentations: [[{ name: "auto-web" }]],
        spanProcessors: [expect.any(HoneycombNativeSpanProcessor)],
      }),
    );
    expect(startMock).toHaveBeenCalledTimes(1);
  });

  it("initHoneycombClient soporta endpoint custom sin apiKey usando skipOptionsValidation y fallback de serviceName", async () => {
    const startMock = vi.fn();
    const honeycombSdkCtor = vi.fn(function HoneycombWebSDKMock(this: { start: typeof startMock }) {
      this.start = startMock;
    });
    const getWebAutoInstrumentationsMock = vi.fn(() => []);

    vi.doMock("@honeycombio/opentelemetry-web", () => ({
      HoneycombWebSDK: honeycombSdkCtor,
    }));
    vi.doMock("@opentelemetry/auto-instrumentations-web", () => ({
      getWebAutoInstrumentations: getWebAutoInstrumentationsMock,
    }));

    delete process.env.NEXT_PUBLIC_HONEYCOMB_API_KEY;
    delete process.env.NEXT_PUBLIC_TELEMETRY_FRONTEND_SERVICE_NAME;
    delete process.env.NEXT_PUBLIC_APP_VERSION;
    process.env.NEXT_PUBLIC_HONEYCOMB_ENDPOINT = "https://otel.b2car.internal";

    const { initHoneycombClient } = await import("./honeycomb");
    await initHoneycombClient();

    expect(honeycombSdkCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "https://otel.b2car.internal",
        skipOptionsValidation: true,
        serviceName: "b2car-frontend",
      }),
    );
    expect(startMock).toHaveBeenCalledTimes(1);
  });

  it("initHoneycombServer configura NodeSDK con defaultResource().merge(...), metricReaders: [], endpoint OTLP y HONEYCOMB_API_KEY", async () => {
    vi.stubGlobal("window", undefined);

    const startMock = vi.fn();
    const shutdownMock = vi.fn().mockResolvedValue(undefined);
    const nodeSdkCtor = vi.fn(function NodeSDKMock(this: { start: typeof startMock; shutdown: typeof shutdownMock }) {
      this.start = startMock;
      this.shutdown = shutdownMock;
    });
    const traceExporterCtor = vi.fn();
    const logExporterCtor = vi.fn();
    const batchSpanProcessorCtor = vi.fn();
    const batchLogProcessorCtor = vi.fn();
    const getNodeAutoInstrumentationsMock = vi.fn((cfg) => cfg);
    const mergedResource = { attributes: { merged: true } };
    const baseResource = { merge: vi.fn(() => mergedResource) };
    const defaultResourceMock = vi.fn(() => baseResource);
    const resourceFromAttributesMock = vi.fn((attrs) => ({ attrs }));

    vi.doMock("@opentelemetry/sdk-node", () => ({ NodeSDK: nodeSdkCtor }));
    vi.doMock("@opentelemetry/auto-instrumentations-node", () => ({
      getNodeAutoInstrumentations: getNodeAutoInstrumentationsMock,
    }));
    vi.doMock("@opentelemetry/exporter-trace-otlp-http", () => ({
      OTLPTraceExporter: traceExporterCtor,
    }));
    vi.doMock("@opentelemetry/exporter-logs-otlp-http", () => ({
      OTLPLogExporter: logExporterCtor,
    }));
    vi.doMock("@opentelemetry/sdk-trace-base", () => ({
      BatchSpanProcessor: batchSpanProcessorCtor,
    }));
    vi.doMock("@opentelemetry/sdk-logs", () => ({
      BatchLogRecordProcessor: batchLogProcessorCtor,
    }));
    vi.doMock("@opentelemetry/resources", () => ({
      defaultResource: defaultResourceMock,
      resourceFromAttributes: resourceFromAttributesMock,
    }));

    (process.env as Record<string, string | undefined>).NEXT_RUNTIME = "nodejs";
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.HONEYCOMB_API_KEY = "hc_server_key";
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "https://api.eu1.honeycomb.io/";
    process.env.TELEMETRY_BACKEND_SERVICE_NAME = "b2car-api";
    process.env.NEXT_PUBLIC_APP_VERSION = "1.13.2";

    const { initHoneycombServer } = await import("./honeycomb");
    await initHoneycombServer();

    expect(traceExporterCtor).toHaveBeenCalledWith({
      url: "https://api.eu1.honeycomb.io/v1/traces",
      headers: { "x-honeycomb-team": "hc_server_key" },
    });
    expect(logExporterCtor).toHaveBeenCalledWith({
      url: "https://api.eu1.honeycomb.io/v1/logs",
      headers: { "x-honeycomb-team": "hc_server_key" },
    });
    expect(defaultResourceMock).toHaveBeenCalledTimes(1);
    expect(resourceFromAttributesMock).toHaveBeenCalledWith({
      "service.version": "1.13.2",
      "deployment.environment.name": "production",
    });
    expect(nodeSdkCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceName: "b2car-api",
        resource: mergedResource,
        metricReaders: [],
      }),
    );

    const httpCfg = getNodeAutoInstrumentationsMock.mock.calls[0]?.[0]?.["@opentelemetry/instrumentation-http"];
    expect(httpCfg.ignoreOutgoingRequestHook({ hostname: "api.eu1.honeycomb.io" })).toBe(true);
    expect(httpCfg.ignoreOutgoingRequestHook({ hostname: "api.b2car.internal" })).toBe(false);
    expect(startMock).toHaveBeenCalledTimes(1);
  });
});

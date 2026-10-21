import type { NextConfig } from "next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  compiler: { emotion: true },
  serverExternalPackages: [
    "@afipsdk/afip.js",
    "dd-trace",
    "@opentelemetry/api",
    "@opentelemetry/api-logs",
    "@opentelemetry/sdk-node",
    "@opentelemetry/sdk-logs",
    "@opentelemetry/auto-instrumentations-node",
    "@opentelemetry/exporter-trace-otlp-http",
    "@opentelemetry/exporter-logs-otlp-http",
    "@opentelemetry/resources",
    "@opentelemetry/semantic-conventions",
  ],
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
};

export default nextConfig;


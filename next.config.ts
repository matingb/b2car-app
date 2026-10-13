import type { NextConfig } from "next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  compiler: { emotion: true },
  serverExternalPackages: [
    "@afipsdk/afip.js",
    "dd-trace",
    "@opentelemetry/api",
    "@opentelemetry/sdk-node",
    "@opentelemetry/auto-instrumentations-node",
    "@opentelemetry/exporter-trace-otlp-http",
    "@opentelemetry/resources",
    "@opentelemetry/semantic-conventions",
  ],
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
};

export default nextConfig;


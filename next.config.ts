import type { NextConfig } from "next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  compiler: { emotion: true },
  serverExternalPackages: [
    "@afipsdk/afip.js",
    "dd-trace",
    "@opentelemetry/sdk-node",
    "@opentelemetry/auto-instrumentations-node",
  ],
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
};

export default nextConfig;


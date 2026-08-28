import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: { emotion: true },
  serverExternalPackages: ["@afipsdk/afip.js"],
};

export default nextConfig;

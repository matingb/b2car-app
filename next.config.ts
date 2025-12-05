import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  compiler: { emotion: true },
  /* config options here */
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["@prisma/client", "bcryptjs", "bullmq", "ioredis"],
  transpilePackages: [
    "@ai-arcade/agent",
    "@ai-arcade/db",
    "@ai-arcade/shared",
    "@ai-arcade/storage"
  ]
};

export default nextConfig;

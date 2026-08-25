import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow local-network IPv4 origins in development.
  allowedDevOrigins: ["*.*.*.*"],
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          },
          { key: "Access-Control-Allow-Headers", value: "*" },
        ],
      },
    ];
  },
};

export default nextConfig;

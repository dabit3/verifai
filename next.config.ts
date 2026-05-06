import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        destination: "https://www.eigencloud.xyz/agentkit",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

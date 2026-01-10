import type { NextConfig } from "next";

const backendUrl =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api$/, "") ||
  "http://localhost:5000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "d2xewl4dlr9aio.cloudfront.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.amazonaws.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;

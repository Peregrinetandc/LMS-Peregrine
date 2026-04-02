import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.56.1","192.168.1.6"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "drive.google.com", pathname: "/**" },
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "googleusercontent.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;

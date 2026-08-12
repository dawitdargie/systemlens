import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable gzip/brotli compression for all responses to reduce
  // payload size and speed up page loads on slower connections.
  compress: true,

  // Allow the hero image from i.ibb.co to be served by next/image.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ibb.co",
      },
    ],
  },
};

export default nextConfig;

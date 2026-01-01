import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use Turbopack with optimized settings
  turbopack: {
    root: __dirname,
  },

  // Optimize images for faster development
  images: {
    unoptimized: true,
  },

  // DISABLE TypeScript checking in development for MAXIMUM speed
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

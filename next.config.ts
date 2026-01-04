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

  // Temporarily enable TypeScript checking to see build errors
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;

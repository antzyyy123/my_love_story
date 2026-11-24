import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static HTML export into the `out/` directory
  output: "export",
  // Required for static export since Next.js Image Optimization needs a server
  images: {
    unoptimized: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A self-contained server folder (.next/standalone) that can be zipped and uploaded to cPanel.
  output: "standalone",
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "framer-motion"],
  },
  images: {
    // Images are served as they are (business logos are small and live in the upload folder),
    // so the hosting server does not need an image-processing library.
    unoptimized: true,
  },
};

export default nextConfig;

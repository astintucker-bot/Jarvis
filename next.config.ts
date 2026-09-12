import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the realtime app run independently if another Next dev server is open.
  distDir: process.env.JARVIS_DIST_DIR || ".next",
};

export default nextConfig;

import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client"],
  distDir: process.env.GRABSTUDENT_DIST_DIR || ".next",
};
export default nextConfig;

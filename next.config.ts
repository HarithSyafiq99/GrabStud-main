import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client"],
  outputFileTracingIncludes: {
    "/api/reports/*": ["./public/fonts/NotoSans-Regular.ttf"],
    "/api/cron/*": ["./public/fonts/NotoSans-Regular.ttf"],
  },
  distDir: process.env.GRABSTUDENT_DIST_DIR || ".next",
};
export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only the explicit LAN launcher enables these detected private hostnames.
  allowedDevOrigins: (process.env.HOMEFOODS_DEV_LAN_HOSTS ?? "").split(",").filter(Boolean),
};

export default nextConfig;

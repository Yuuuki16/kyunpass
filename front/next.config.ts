import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // front/ の外にある /db 配下のコードを import できるようにする
    externalDir: true,
  },
};

export default nextConfig;

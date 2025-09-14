/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@/components/ui",
    "@repo/utils",
    "@repo/config",
    "@repo/db",
    "@repo/trpc",
  ],
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  output: "standalone",
  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },
};

module.exports = nextConfig;

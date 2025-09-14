/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbo: {
      rules: {
        "*.svg": {
          loaders: ["@svgr/webpack"],
          as: "*.js",
        },
      },
    },
  },
  transpilePackages: ["@repo/ui", "@repo/utils", "@repo/config", "@repo/db", "@repo/trpc"],
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  output: "standalone",
};

module.exports = nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  serverExternalPackages: ['muhammara'],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'aws-sdk': false,
      'nock': false,
      'mock-aws-s3': false,
      canvas: false,
    };
    return config;
  },
};

export default nextConfig;

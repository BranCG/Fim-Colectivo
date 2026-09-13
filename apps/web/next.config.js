/** @type {import('next').NextConfig} */
const nextConfig = {
  // Solo export estático si se solicita explícitamente para mobile
  ...(process.env.NEXT_EXPORT === 'true' ? { output: 'export' } : {}),
  trailingSlash: true,
  images: {
    unoptimized: true,
    domains: ['localhost'],
  },
  reactStrictMode: true,
  swcMinify: true,
  productionBrowserSourceMaps: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
};

module.exports = nextConfig;

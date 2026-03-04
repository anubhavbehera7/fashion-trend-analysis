/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',  // Optimized for Docker deployment
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: 'minio' },
    ],
  },
};

module.exports = nextConfig;

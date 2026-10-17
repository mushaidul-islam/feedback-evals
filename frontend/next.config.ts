import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        port: '',
        pathname: '/vi/*/hqdefault.jpg',
        search: '',
      },
    ],
    maximumRedirects: 0,
  },
};

export default nextConfig;

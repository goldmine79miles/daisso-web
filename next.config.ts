import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'via.placeholder.com' },
      { protocol: 'https', hostname: 'shopping.toss.im' },
      { protocol: 'https', hostname: 'static.toss.im' },
      { protocol: 'https', hostname: 'ads-partners.coupang.com' },
    ],
  },
};

export default nextConfig;

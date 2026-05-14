/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    BRAND_URL: process.env.BRAND_URL,
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const pollBaseUrl = process.env.NEXT_PUBLIC_POLL_BASE_URL || 'http://localhost:3000/auth';
    return [
      {
        source: '/public/:path*',
        destination: `${apiUrl}/public/:path*`,
      },
      {
        // Proxy poll assets so the browser doesn't send an Origin header
        // directly to ssoapi (which causes a 500 on localhost)
        source: '/poll-proxy/assets/:path*',
        destination: `${pollBaseUrl}/assets/:path*`,
      },
      {
        // Proxy poll API calls for the same reason
        source: '/poll-proxy/api/:path*',
        destination: `${pollBaseUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;


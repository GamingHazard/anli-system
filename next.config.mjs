/** @type {import('next').NextConfig} */
const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/+$/, '')

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    if (!apiProxyTarget) return []

    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: `${apiProxyTarget}/api/:path*`,
        },
        {
          source: '/socket.io/:path*',
          destination: `${apiProxyTarget}/socket.io/:path*`,
        },
      ],
    }
  },
}

export default nextConfig

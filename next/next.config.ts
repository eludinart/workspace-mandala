import type { NextConfig } from 'next'
import path from 'path'

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '') || ''
const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '') || ''

const nextConfig: NextConfig = {
  ...(basePath ? { basePath, assetPrefix: `${basePath}/` } : {}),
  ...(appUrl ? { metadataBase: new URL(appUrl) } : {}),
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
  outputFileTracingRoot: path.resolve(process.cwd()),
  reactStrictMode: true,
  async headers() {
    if (process.env.NODE_ENV !== 'production' || !appUrl.startsWith('https://')) {
      return []
    }
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: 'upgrade-insecure-requests',
          },
        ],
      },
    ]
  },
}

export default nextConfig

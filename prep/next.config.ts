import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  // The repo root has its own lockfile (the Kosh app); this app is self-contained.
  turbopack: { root: path.join(__dirname) },
  outputFileTracingRoot: path.join(__dirname),
  // web-push is ESM-only and uses Node crypto; keep it out of the bundle.
  serverExternalPackages: ['web-push', 'mongodb'],
  experimental: {
    serverActions: { bodySizeLimit: '1mb' },
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ]
  },
}

export default nextConfig

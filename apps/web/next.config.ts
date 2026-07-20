import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import withSerwistInit from '@serwist/next';
import type { NextConfig } from 'next';

const withNextIntl = require('next-intl/plugin')('./i18n/request.ts');

function getBuildRevision() {
  const output = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' });
  const hash = output.stdout?.trim();
  if (hash) {
    return hash.slice(0, 7);
  }
  return randomUUID();
}

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  additionalPrecacheEntries: [
    { url: '/offline.html', revision: getBuildRevision() },
  ],
  disable: process.env.NODE_ENV === 'development',
});

function getHostname(urlValue: string | undefined, fallback: string) {
  try {
    return new URL(urlValue || fallback).hostname;
  } catch {
    return new URL(fallback).hostname;
  }
}

const shikimoriHost = getHostname(process.env.SHIKIMORI_BASE_URL, 'https://shikimori.one');

const nextConfig: NextConfig = {
  output: 'standalone',
  // Silence multi-lockfile warning; monorepo root is two levels up from apps/web.
  outputFileTracingRoot: path.join(__dirname, '../..'),
  turbopack: {
    // Turbopack is now stable, moved from experimental.turbo
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'myanimelist.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'anilist.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: shikimoriHost,
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default withSerwist(withNextIntl(nextConfig));

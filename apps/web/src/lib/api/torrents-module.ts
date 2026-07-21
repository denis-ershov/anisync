import { NextResponse } from 'next/server';

import { isFeatureEnabled } from '@/lib/feature-flags.server';

export function isTorrentsModuleEnabled() {
  return isFeatureEnabled('torrents');
}

export function torrentsModuleDisabledResponse() {
  return NextResponse.json({ error: 'Torrents module is disabled' }, { status: 503 });
}

/** Module flag for the unified local AniSync torrent runtime. */
export function assertTorrentServiceReady() {
  if (!isTorrentsModuleEnabled()) {
    return torrentsModuleDisabledResponse();
  }

  return null;
}

export function torrentServiceErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const status = message.includes('not found') ? 404 : 500;

  return NextResponse.json(
    {
      error: status === 404 ? message : 'Internal server error',
      message,
    },
    { status }
  );
}

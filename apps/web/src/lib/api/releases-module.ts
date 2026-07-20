import { NextResponse } from 'next/server';

import { isFeatureEnabled } from '@/lib/feature-flags';

export function isReleasesModuleEnabled() {
  return isFeatureEnabled('releases');
}

export function releasesModuleDisabledResponse() {
  return NextResponse.json({ error: 'Releases module is disabled' }, { status: 503 });
}

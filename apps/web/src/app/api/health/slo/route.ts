import { NextRequest, NextResponse } from 'next/server';

import { hasHealthAccess } from '@/lib/api/health';
import { getTrackedApiSloSummary } from '@/lib/observability/slo-metrics';

export async function GET(request: NextRequest) {
  if (!hasHealthAccess(request)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    status: 'ok',
    api: getTrackedApiSloSummary(),
    timestamp: new Date().toISOString(),
  });
}

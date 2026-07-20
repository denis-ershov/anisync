import { NextRequest, NextResponse } from 'next/server';
import { hasHealthAccess } from '@/lib/api/health';

export async function GET(request: NextRequest) {
  if (!hasHealthAccess(request)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    status: 'ok',
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasJwtSecret: !!process.env.JWT_SECRET,
    hasCronSecret: !!process.env.CRON_SECRET,
    hasSentryDsn: !!process.env.SENTRY_DSN,
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
}


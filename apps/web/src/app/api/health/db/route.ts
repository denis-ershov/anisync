import { NextRequest, NextResponse } from 'next/server';
import { hasHealthAccess } from '@/lib/api/health';
import { testConnection } from '@/lib/db';

export async function GET(request: NextRequest) {
  if (!hasHealthAccess(request)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const isConnected = await testConnection();
    
    if (isConnected) {
      return NextResponse.json({
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      status: 'error',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  } catch (error) {
    console.error('Database health check error:', error);
    
    return NextResponse.json({
      status: 'error',
      database: 'error',
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }
}


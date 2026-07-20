import { NextRequest, NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/api/auth';
import { IntegrationService } from '@/lib/services/integration-service';

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    const integrations = await IntegrationService.getUserIntegrations(user.id);
    
    return NextResponse.json({
      integrations,
      settings: user.settings,
    });
  } catch (error) {
    console.error('Get integrations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

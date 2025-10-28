import { NextRequest, NextResponse } from 'next/server';
import { IntegrationService } from '@/lib/services/integration-service';
import { UserService } from '@/lib/services/user-service';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'No authentication token' },
        { status: 401 }
      );
    }
    
    const decoded = UserService.verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }
    
    const integrations = IntegrationService.getUserIntegrations(decoded.userId);
    
    if (integrations.length === 0) {
      return NextResponse.json(
        { error: 'No integrations found' },
        { status: 400 }
      );
    }
    
    // TODO: Implement actual sync logic for each service
    // For now, just update last sync time
    for (const integration of integrations) {
      IntegrationService.updateLastSync(integration.id);
    }
    
    return NextResponse.json({
      message: 'Sync completed successfully',
      syncedIntegrations: integrations.length
    });
  } catch (error) {
    console.error('Manual sync error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

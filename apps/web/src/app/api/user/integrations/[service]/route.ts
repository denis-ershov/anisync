import { NextRequest, NextResponse } from 'next/server';
import { requireCurrentUserId } from '@/lib/api/auth';
import { IntegrationService } from '@/lib/services/integration-service';
import { UpdateIntegrationData } from '@/lib/types';

function isSupportedService(service: string): service is 'shikimori' | 'myanimelist' | 'anilist' {
  return service === 'shikimori' || service === 'myanimelist' || service === 'anilist';
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ service: string }> }
) {
  try {
    const { service } = await params;
    if (!isSupportedService(service)) {
      return NextResponse.json({ error: 'Unsupported integration service' }, { status: 400 });
    }

    const userId = await requireCurrentUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body: UpdateIntegrationData = await request.json();

    const updatedIntegration = await IntegrationService.updateIntegrationByUserAndService(
      userId,
      service,
      body
    );
    
    if (!updatedIntegration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      message: 'Integration updated successfully',
      integration: updatedIntegration
    });
  } catch (error) {
    console.error('Update integration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ service: string }> }
) {
  try {
    const { service } = await params;
    if (!isSupportedService(service)) {
      return NextResponse.json({ error: 'Unsupported integration service' }, { status: 400 });
    }

    const userId = await requireCurrentUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const success = await IntegrationService.deleteIntegrationByUserAndService(
      userId,
      service
    );
    
    if (!success) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      message: 'Integration deleted successfully'
    });
  } catch (error) {
    console.error('Delete integration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

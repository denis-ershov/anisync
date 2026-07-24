import { NextRequest, NextResponse } from 'next/server';
import { requireCurrentUserId } from '@/lib/api/auth';
import { UserSettingsService } from '@/lib/services/user-service';
import type { UpdateUserSettingsData } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const userId = await requireCurrentUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const settings = await UserSettingsService.getUserSettings(userId);
    if (!settings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }

    return NextResponse.json({ settings });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await requireCurrentUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body: UpdateUserSettingsData = await request.json();
    try {
      const updatedSettings = await UserSettingsService.updateUserSettings(userId, body);
      if (!updatedSettings) {
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Settings updated successfully',
        settings: updatedSettings,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('must be a connected')) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      throw error;
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

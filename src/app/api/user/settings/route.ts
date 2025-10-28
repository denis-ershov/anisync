import { NextRequest, NextResponse } from 'next/server';
import { UserService, UserSettingsService } from '@/lib/services/user-service';
import { UpdateUserSettingsData } from '@/lib/types';

export async function PUT(request: NextRequest) {
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
    
    const body: UpdateUserSettingsData = await request.json();
    
    const updatedSettings = UserSettingsService.updateUserSettings(decoded.userId, body);
    
    if (!updatedSettings) {
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      message: 'Settings updated successfully',
      settings: updatedSettings
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

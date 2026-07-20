import { NextRequest, NextResponse } from 'next/server';
import { requireCurrentUserId } from '@/lib/api/auth';
import { UserService } from '@/lib/services/user-service';

export async function PUT(request: NextRequest) {
  try {
    const userId = await requireCurrentUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    if (!body.currentPassword || !body.newPassword || body.newPassword !== body.confirmPassword) {
      return NextResponse.json({ error: 'Invalid password payload' }, { status: 400 });
    }

    const changed = await UserService.changePassword(userId, body.currentPassword, body.newPassword);
    if (!changed) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    const response = NextResponse.json({ message: 'Password updated successfully' });
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

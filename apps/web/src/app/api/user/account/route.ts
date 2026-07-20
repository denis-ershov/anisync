import { NextRequest, NextResponse } from 'next/server';
import { requireCurrentUserId } from '@/lib/api/auth';
import { UserService } from '@/lib/services/user-service';

export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireCurrentUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    if (!body.password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const user = await UserService.getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const valid = await UserService.verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Password is incorrect' }, { status: 400 });
    }

    await UserService.deleteUser(userId);
    const response = NextResponse.json({ message: 'Account deleted successfully' });
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

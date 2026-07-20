import { NextRequest, NextResponse } from 'next/server';
import { requireCurrentUserId } from '@/lib/api/auth';
import { UserService } from '@/lib/services/user-service';

export async function POST(request: NextRequest) {
  const userId = await requireCurrentUserId(request);
  if (userId) {
    await UserService.clearUserSessions(userId);
  }

  const response = NextResponse.json({ message: 'Logout successful' }, { status: 200 });
  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}

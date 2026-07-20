import { NextRequest, NextResponse } from 'next/server';
import type { LoginData } from '@/lib/types';
import { withSloRoute } from '@/lib/api/with-slo';
import { UserService } from '@/lib/services/user-service';

async function postHandler(request: NextRequest) {
  try {
    const body: LoginData = await request.json();
    if (!body.email || !body.password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const result = await UserService.login(body);
    if (!result) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const response = NextResponse.json(
      { message: 'Login successful', user: result.user, token: result.token },
      { status: 200 }
    );
    response.cookies.set('auth-token', result.token, {
      httpOnly: true,
      secure: Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production'),
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

export const POST = withSloRoute('/api/auth/login', postHandler);

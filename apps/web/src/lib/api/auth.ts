import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { UserService } from '@/lib/services/user-service';

export async function getRequestToken(request?: NextRequest) {
  if (request) {
    const cookieToken = request.cookies.get('auth-token')?.value;
    if (cookieToken) {
      return cookieToken;
    }

    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
  }

  const cookieStore = await cookies();
  return cookieStore.get('auth-token')?.value;
}

export async function requireCurrentUser(request?: NextRequest) {
  const token = await getRequestToken(request);
  if (!token) {
    return null;
  }

  const decoded = await UserService.verifySessionToken(token);
  if (!decoded) {
    return null;
  }

  return UserService.getUserWithSettings(decoded.userId);
}

export async function requireCurrentUserId(request?: NextRequest) {
  const token = await getRequestToken(request);
  if (!token) {
    return null;
  }

  const decoded = await UserService.verifySessionToken(token);
  return decoded?.userId || null;
}

export async function requireAdminUser(request?: NextRequest) {
  const user = await requireCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return null;
  }
  return user;
}

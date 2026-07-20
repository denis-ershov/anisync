import { NextRequest, NextResponse } from 'next/server';
import { requireCurrentUserId } from '@/lib/api/auth';
import type { UpdateUserData } from '@/lib/types';
import { UserService } from '@/lib/services/user-service';

export async function PUT(request: NextRequest) {
  try {
    const userId = await requireCurrentUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body: UpdateUserData = await request.json();
    if (body.username) {
      const existing = await UserService.getUserByUsername(body.username);
      if (existing && existing.id !== userId) {
        return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
      }
    }

    if (body.email) {
      const existing = await UserService.getUserByEmail(body.email);
      if (existing && existing.id !== userId) {
        return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
      }
    }

    const updatedUser = await UserService.updateUser(userId, body);
    if (!updatedUser) {
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }

    const { passwordHash, ...userWithoutPassword } = updatedUser;
    return NextResponse.json({ message: 'Profile updated successfully', user: userWithoutPassword });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

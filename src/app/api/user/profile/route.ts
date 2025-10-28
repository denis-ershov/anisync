import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/user-service';
import { UpdateUserData } from '@/lib/types';

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
    
    const body: UpdateUserData = await request.json();
    
    // Check if username or email already exists (excluding current user)
    if (body.username) {
      const existingUser = UserService.getUserByUsername(body.username);
      if (existingUser && existingUser.id !== decoded.userId) {
        return NextResponse.json(
          { error: 'Username already exists' },
          { status: 409 }
        );
      }
    }
    
    if (body.email) {
      const existingUser = UserService.getUserByEmail(body.email);
      if (existingUser && existingUser.id !== decoded.userId) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 409 }
        );
      }
    }
    
    const updatedUser = await UserService.updateUser(decoded.userId, body);
    
    if (!updatedUser) {
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      );
    }
    
    // Return user without password hash
    const { password_hash, ...userWithoutPassword } = updatedUser;
    
    return NextResponse.json({
      message: 'Profile updated successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

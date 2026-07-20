import { NextRequest, NextResponse } from 'next/server';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { UserService } from '@/lib/services/user-service';
import { CreateUserData } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    if (!isFeatureEnabled('registration')) {
      return NextResponse.json(
        { error: 'Registration is closed' },
        { status: 403 }
      );
    }

    const body: CreateUserData & { locale?: string } = await request.json();
    
    // Validate required fields
    if (!body.username || !body.email || !body.password) {
      return NextResponse.json(
        { error: 'Username, email, and password are required' },
        { status: 400 }
      );
    }
    
    // Check if user already exists
    const existingUserByEmail = await UserService.getUserByEmail(body.email);
    if (existingUserByEmail) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    const existingUserByUsername = await UserService.getUserByUsername(body.username);
    if (existingUserByUsername) {
      return NextResponse.json(
        { error: 'User with this username already exists' },
        { status: 409 }
      );
    }

    // Extract locale and create user
    const { locale, ...userData } = body;
    const user = await UserService.createUser(userData, locale || 'en');

    // Return user without password hash
    const { passwordHash, ...userWithoutPassword } = user;
    
    return NextResponse.json(
      { message: 'User created successfully', user: userWithoutPassword },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Log full error details for debugging
    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack,
      error
    });
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}

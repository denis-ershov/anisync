import { NextRequest } from 'next/server';
import { handleOAuthCallback } from '@/lib/integrations/oauth';

export async function GET(request: NextRequest) {
  return handleOAuthCallback(request, 'shikimori');
}

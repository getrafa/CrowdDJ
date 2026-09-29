import { NextRequest, NextResponse } from 'next/server';
import { getSpotifyAuthUrl } from '@/lib/spotify/api';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const roomCode = searchParams.get('roomCode') || undefined;

  const authUrl = getSpotifyAuthUrl(roomCode, request.nextUrl.origin);
  return NextResponse.redirect(authUrl);
}

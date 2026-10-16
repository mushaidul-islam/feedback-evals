import { NextResponse } from 'next/server';

import { callbackUrl, googleCredentials, STATE_COOKIE } from '@/lib/google-oauth';

// The sign-in button links here. Sends the browser to Google's sign-in page.
export function GET(request: Request) {
  const google = googleCredentials();
  if (!google) return NextResponse.redirect(new URL('/login?error=config', request.url));

  const state = crypto.randomUUID();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: google.clientId,
    redirect_uri: callbackUrl(request),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    // Always show the account chooser, so someone with several Google
    // accounts can pick the right one.
    prompt: 'select_account',
  }).toString();

  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    // Lax still sends it when Google redirects back to us.
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 10 * 60,
  });
  return response;
}

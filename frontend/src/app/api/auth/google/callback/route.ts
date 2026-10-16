import { NextResponse, type NextRequest } from 'next/server';

import { API_URL } from '@/lib/api-proxy';
import { SESSION_COOKIE } from '@/lib/auth-cookie';
import { callbackUrl, googleCredentials, STATE_COOKIE } from '@/lib/google-oauth';

// Google sends the browser back here after sign-in, with a one-time code.
//
// 1. Check the state matches the cookie set before leaving for Google.
// 2. Trade the code with Google for an ID token: Google's signed statement
//    of who this person is. This needs the client secret, which is why it
//    happens on the server.
// 3. Hand the ID token to the Go API, which checks it and creates a session.
// 4. Keep the session token in a cookie and go to the dashboard.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const fail = (reason: string) => {
    const response = NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));
    response.cookies.delete(STATE_COOKIE);
    return response;
  };

  // The person pressed "Cancel" on Google's page.
  if (params.get('error')) return fail('cancelled');

  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state || state !== request.cookies.get(STATE_COOKIE)?.value) {
    return fail('failed');
  }

  const google = googleCredentials();
  if (!google) return fail('config');

  try {
    const tokens = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: google.clientId,
        client_secret: google.clientSecret,
        redirect_uri: callbackUrl(request),
        grant_type: 'authorization_code',
      }),
      cache: 'no-store',
    });
    const { id_token: idToken } = (await tokens.json()) as { id_token?: string };
    if (!tokens.ok || !idToken) return fail('failed');

    const signIn = await fetch(`${API_URL}/api/v1/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: idToken }),
      cache: 'no-store',
    });
    if (!signIn.ok) return fail('failed');
    const session = (await signIn.json()) as { token: string; expires_at: string };

    const response = NextResponse.redirect(new URL('/c', request.url));
    response.cookies.delete(STATE_COOKIE);
    response.cookies.set(SESSION_COOKIE, session.token, {
      // Page scripts cannot read it, so a script injected into the page
      // cannot steal the session.
      httpOnly: true,
      sameSite: 'lax',
      // Local development is plain http; production must be https.
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: new Date(session.expires_at),
    });
    return response;
  } catch {
    return fail('failed');
  }
}

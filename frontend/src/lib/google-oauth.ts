import 'server-only';

// Holds the random "state" value between leaving for Google and coming back.
// If the value Google returns doesn't match this cookie, the sign-in did not
// start on this site and is refused.
export const STATE_COOKIE = 'tbt_oauth_state';

export function googleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

// Where Google sends the browser back to. It must exactly match an
// "Authorized redirect URI" on the OAuth client in Google Cloud Console.
export function callbackUrl(request: Request): string {
  return new URL('/api/auth/google/callback', request.url).toString();
}

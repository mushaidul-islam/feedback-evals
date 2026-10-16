import { NextResponse, type NextRequest } from 'next/server';

import { SESSION_COOKIE } from '@/lib/auth-cookie';

// Pages anyone can open without signing in.
function isPublic(pathname: string): boolean {
  return pathname === '/login' || pathname.startsWith('/f/');
}

// Sends anyone without a session cookie to /login, for every page except the
// public ones above. This only checks that the cookie exists. Whether the
// session is still valid is the API's decision, and the pages redirect to
// /login if it says no.
export function proxy(request: NextRequest) {
  if (isPublic(request.nextUrl.pathname) || request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  // Skip API routes (they answer 401 themselves), Next.js internals, and
  // files with an extension such as favicon.ico or images in public/.
  matcher: ['/((?!api/|_next/|.*\\..*).*)'],
};

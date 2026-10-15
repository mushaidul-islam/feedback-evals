import { cookies } from 'next/headers';

import { forwardAPI } from '@/lib/api-proxy';
import { SESSION_COOKIE } from '@/lib/auth-cookie';

export async function POST(request: Request) {
  // End the session on the server too, so a copied cookie stops working.
  await forwardAPI(request, '/auth/logout', true);
  (await cookies()).delete(SESSION_COOKIE);
  return new Response(null, { status: 204 });
}

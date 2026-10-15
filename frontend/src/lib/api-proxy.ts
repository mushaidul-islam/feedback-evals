import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE } from './auth-cookie';

export const API_URL = process.env.API_URL ?? 'http://localhost:8080';

export async function forwardAPI(
  request: Request,
  path: string,
  protectedRoute = false,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (protectedRoute) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    // No cookie means not signed in; no need to ask the API.
    if (!token) return Response.json({ error: 'Sign in required' }, { status: 401 });
    headers.Authorization = `Bearer ${token}`;
  }
  if (request.method === 'POST') headers['Content-Type'] = 'application/json';

  try {
    const upstream = await fetch(`${API_URL}/api/v1${path}`, {
      method: request.method,
      headers,
      body: request.method === 'POST' ? await request.text() : undefined,
      cache: 'no-store',
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
    });
  } catch {
    return Response.json({ error: 'API unavailable' }, { status: 502 });
  }
}

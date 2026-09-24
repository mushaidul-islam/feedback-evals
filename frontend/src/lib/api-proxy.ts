import 'server-only';

export async function forwardAPI(
  request: Request,
  path: string,
  protectedRoute = false,
): Promise<Response> {
  const headers: HeadersInit = {};
  if (protectedRoute) headers.Authorization = 'Bearer test-key';
  if (request.method === 'POST') headers['Content-Type'] = 'application/json';

  try {
    const upstream = await fetch(
      `${process.env.API_URL ?? 'http://localhost:8080'}/api/v1${path}`,
      {
        method: request.method,
        headers,
        body: request.method === 'POST' ? await request.text() : undefined,
        cache: 'no-store',
      },
    );
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
    });
  } catch {
    return Response.json({ error: 'API unavailable' }, { status: 502 });
  }
}

import { forwardAPI } from '@/lib/api-proxy';

export function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('campaign_id') ?? '';
  return forwardAPI(request, `/feedback/?campaign_id=${encodeURIComponent(id)}`, true);
}

export function POST(request: Request) {
  return forwardAPI(request, '/feedback/');
}

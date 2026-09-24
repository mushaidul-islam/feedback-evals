import { forwardAPI } from '@/lib/api-proxy';

export function GET(request: Request) {
  return forwardAPI(request, '/campaign/', true);
}

export function POST(request: Request) {
  return forwardAPI(request, '/campaign/', true);
}

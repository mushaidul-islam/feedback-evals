import { forwardAPI } from '@/lib/api-proxy';

export function GET(request: Request) {
  return forwardAPI(request, '/auth/me', true);
}

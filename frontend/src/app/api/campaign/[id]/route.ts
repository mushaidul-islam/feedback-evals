import { forwardAPI } from '@/lib/api-proxy';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forwardAPI(request, `/campaign/${encodeURIComponent(id)}`, true);
}

import 'server-only';
import { notFound } from 'next/navigation';

const apiUrl = process.env.API_URL ?? 'http://localhost:8080';
const creatorKey = 'Bearer test-key';

export type Campaign = { id: string; name: string; created_at: string; feedback_count?: number };
export type Feedback = { id: string; campaign_id: string; text: string; created_at: string };

async function api<T>(path: string, protectedRoute = false): Promise<T> {
  const response = await fetch(`${apiUrl}/api/v1${path}`, {
    headers: protectedRoute ? { Authorization: creatorKey } : undefined,
    cache: 'no-store',
  });
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error(`API request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export const listCampaigns = () => api<Campaign[]>('/campaign/', true);
export const getCampaign = (id: string) =>
  api<Campaign>(`/campaign/${encodeURIComponent(id)}`, true);
export const getPublicCampaign = (id: string) =>
  api<Campaign>(`/campaign/${encodeURIComponent(id)}/public`);
export const listFeedback = (id: string) =>
  api<Feedback[]>(`/feedback/?campaign_id=${encodeURIComponent(id)}`, true);

export async function createCampaignRequest(name: string): Promise<Campaign> {
  const response = await fetch(`${apiUrl}/api/v1/campaign/`, {
    method: 'POST',
    headers: { Authorization: creatorKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Could not create campaign (${response.status})`);
  return response.json() as Promise<Campaign>;
}

export async function submitFeedbackRequest(campaignId: string, text: string): Promise<void> {
  const response = await fetch(`${apiUrl}/api/v1/feedback/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaign_id: campaignId, text }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Could not send feedback (${response.status})`);
}

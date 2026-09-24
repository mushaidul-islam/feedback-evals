'use server';

import { redirect } from 'next/navigation';

import { createCampaignRequest, submitFeedbackRequest } from '@/lib/api';

export type FormState = { message: string; sent?: boolean };

export async function createCampaign(_state: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { message: 'Enter a campaign name.' };
  let id: string;
  try {
    id = (await createCampaignRequest(name)).id;
  } catch {
    return { message: 'Could not create the campaign. Please try again.' };
  }
  redirect(`/c/${id}`);
}

export async function submitFeedback(
  campaignId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const text = String(formData.get('text') ?? '');
  if ([...text.trim()].length < 10) return { message: 'Write at least 10 characters.' };
  try {
    await submitFeedbackRequest(campaignId, text);
  } catch {
    return { message: 'Could not send your feedback. Please try again.' };
  }
  return { message: 'Your feedback was sent.', sent: true };
}

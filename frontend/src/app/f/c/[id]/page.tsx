'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Campaign } from '@/lib/api-types';

import { FeedbackForm } from './feedback-form';

export default function CollectionPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setCampaign(null);
    setError('');
    fetch(`/api/campaign/${encodeURIComponent(id)}/public`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Could not load campaign');
        return response.json() as Promise<Campaign>;
      })
      .then((loaded) => {
        if (!controller.signal.aborted) setCampaign(loaded);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('Could not load this campaign. Refresh the page to try again.');
      });
    return () => controller.abort();
  }, [id]);

  return (
    <main className="grid min-h-screen place-items-center px-5 py-5 sm:px-8">
      <div className="w-full max-w-3xl">
        <p className="font-head text-sm tracking-widest uppercase">
          Truth Be Told / Anonymous feedback
        </p>
        {error && (
          <Alert status="error" className="mt-10">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!campaign && !error && <p className="mt-10 text-lg">Loading campaign…</p>}
        {campaign && (
          <>
            <h4 className="mt-20 mb-6 max-w-2xl font-sans text-xl leading-snug font-bold sm:text-2xl">
              {campaign.name}
            </h4>
            <FeedbackForm campaignId={campaign.id} />
          </>
        )}
      </div>
    </main>
  );
}

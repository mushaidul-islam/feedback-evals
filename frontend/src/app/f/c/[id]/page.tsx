'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { CampaignPreview } from '@/components/campaign-preview';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Campaign } from '@/lib/api-types';

import { FeedbackForm } from './feedback-form';

export default function CollectionPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState('');
  const creator = campaign?.creator_name?.trim() || 'Someone';
  const initials = creator
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

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
    <main className="min-h-screen px-5 py-8 sm:px-8 lg:py-12">
      <div className="mx-auto w-full max-w-7xl">
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
            <header className="mt-10 mb-8 max-w-4xl sm:mt-14 sm:mb-12">
              <div className="mb-6 flex items-center gap-4">
                <Avatar
                  key={campaign.creator_picture || creator}
                  className="bg-primary size-14 border-black shadow-md sm:size-16"
                >
                  <AvatarImage src={campaign.creator_picture} alt="" referrerPolicy="no-referrer" />
                  <AvatarFallback className="bg-primary text-lg text-black">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <p className="min-w-0 text-lg leading-tight break-words sm:text-xl">
                  <span className="font-head">{creator}</span>
                  <span className="mt-1 block text-sm">wants your honest feedback</span>
                </p>
              </div>
              <h1 className="font-head text-4xl leading-[1.08] tracking-tight break-words sm:text-6xl lg:text-7xl">
                <span className="bg-primary box-decoration-clone px-1">{campaign.name}</span>
              </h1>
            </header>
            <div
              className={
                campaign.content
                  ? 'grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12'
                  : 'max-w-2xl'
              }
            >
              {campaign.content && (
                <CampaignPreview key={campaign.content.url} content={campaign.content} />
              )}
              <div className="min-w-0 lg:sticky lg:top-8">
                <p className="font-head mb-3 text-sm tracking-widest uppercase">
                  Your take. No name attached.
                </p>
                <FeedbackForm campaignId={campaign.id} />
                <p className="text-muted-foreground mt-5 text-sm">
                  Be honest. Be specific. Help them get better.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

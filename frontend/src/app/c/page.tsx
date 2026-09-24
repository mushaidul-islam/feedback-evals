'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Campaign } from '@/lib/api-types';

import { CreateForm } from './create-form';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/campaign', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Could not load campaigns');
        return response.json() as Promise<Campaign[]>;
      })
      .then((loaded) => {
        if (!controller.signal.aborted) setCampaigns(loaded);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('Could not load campaigns. Refresh the page to try again.');
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
      <p className="font-head text-sm tracking-widest uppercase">Truth Be Told / Campaigns</p>
      <h1 className="font-head mt-4 text-5xl uppercase sm:text-7xl">Your campaigns</h1>
      <p className="mt-4 max-w-2xl text-lg">
        Create a feedback link, then open a campaign to see what people sent.
      </p>
      <Card className="bg-accent mt-10">
        <CardHeader>
          <CardTitle className="font-head text-2xl uppercase">Start a campaign</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateForm />
        </CardContent>
      </Card>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {campaigns?.map((campaign, index) => (
          <Link
            key={campaign.id}
            href={`/c/${campaign.id}`}
            className="focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-black"
          >
            <Card
              className={
                index % 2
                  ? 'bg-primary h-full transition-transform hover:-translate-y-1'
                  : 'h-full bg-white transition-transform hover:-translate-y-1'
              }
            >
              <CardHeader>
                <CardTitle className="font-head text-2xl break-words uppercase">
                  {campaign.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-sm">
                  Created {new Date(campaign.created_at).toLocaleDateString()}
                </p>
                <p className="font-head mt-5 uppercase">
                  {campaign.feedback_count ?? 0} responses · View feedback →
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {campaigns === null && !error && <p className="mt-12 text-lg">Loading campaigns…</p>}
      {error && (
        <Alert status="error" className="mt-12">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {campaigns?.length === 0 && (
        <p className="mt-12 text-lg">No campaigns yet. Create one above to get started.</p>
      )}
    </main>
  );
}

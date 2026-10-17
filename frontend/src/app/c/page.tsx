'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Campaign } from '@/lib/api-types';

import { AccountBar } from './account-bar';
import { CreateForm } from './create-form';

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/campaign', { signal: controller.signal })
      .then((response) => {
        // The session cookie exists but the API no longer accepts it.
        if (response.status === 401) {
          router.replace('/login');
          return null;
        }
        if (!response.ok) throw new Error('Could not load campaigns');
        return response.json() as Promise<Campaign[]>;
      })
      .then((loaded) => {
        if (loaded && !controller.signal.aborted) setCampaigns(loaded);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('Could not load campaigns. Refresh the page to try again.');
      });
    return () => controller.abort();
  }, [router]);

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="font-head text-sm tracking-widest uppercase">Truth Be Told / Campaigns</p>
        <AccountBar />
      </div>
      <h1 className="font-head mt-10 text-4xl leading-[1.08] tracking-tight sm:mt-14 sm:text-6xl lg:text-7xl">
        <span className="bg-primary box-decoration-clone px-1">Your campaigns</span>
      </h1>
      <p className="mt-4 max-w-2xl text-lg">
        Create a feedback link, then open a campaign to see what people sent.
      </p>
      <div className="mt-10 grid items-start gap-8 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
        <Card className="bg-accent min-w-0 lg:sticky lg:top-8">
          <CardHeader>
            <CardTitle className="font-head text-2xl uppercase">Start a campaign</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateForm />
          </CardContent>
        </Card>
        <section aria-label="Your campaigns" className="min-w-0">
          <p className="font-head mb-6 border-b-2 border-black pb-4 text-sm tracking-widest uppercase">
            Your links
          </p>
          <div className="grid gap-6">
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
                    <CardTitle className="font-head text-2xl break-words">
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
            <p className="mt-12 text-lg">Your campaigns will appear here after you create one.</p>
          )}
        </section>
      </div>
    </main>
  );
}

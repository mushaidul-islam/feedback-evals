'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { CampaignPreview } from '@/components/campaign-preview';
import { ShareDialog } from '@/components/share-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Campaign, Feedback } from '@/lib/api-types';

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [error, setError] = useState('');
  const [share, setShare] = useState<Feedback | 'campaign' | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setCampaign(null);
    setShare(null);
    setError('');
    Promise.all([
      fetch(`/api/campaign/${encodeURIComponent(id)}`, { signal: controller.signal }),
      fetch(`/api/feedback?campaign_id=${encodeURIComponent(id)}`, { signal: controller.signal }),
    ])
      .then(async ([campaignResponse, feedbackResponse]) => {
        // The session cookie exists but the API no longer accepts it.
        if (campaignResponse.status === 401 || feedbackResponse.status === 401) {
          router.replace('/login');
          return null;
        }
        if (!campaignResponse.ok || !feedbackResponse.ok)
          throw new Error('Could not load campaign');
        return Promise.all([
          campaignResponse.json() as Promise<Campaign>,
          feedbackResponse.json() as Promise<Feedback[]>,
        ]);
      })
      .then((loaded) => {
        if (!loaded || controller.signal.aborted) return;
        const [loadedCampaign, loadedFeedback] = loaded;
        setCampaign(loadedCampaign);
        setFeedback(loadedFeedback);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('Could not load this campaign. Refresh the page to try again.');
      });
    return () => controller.abort();
  }, [id, router]);

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <Link href="/c" className="font-head text-sm uppercase underline">
        ← All campaigns
      </Link>
      {error && (
        <Alert status="error" className="mt-8">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!campaign && !error && <p className="mt-8 text-lg">Loading campaign…</p>}
      {campaign && (
        <>
          <header className="mt-10 mb-10 sm:mt-14 sm:mb-12">
            <p className="font-head mb-5 text-sm tracking-widest uppercase">
              Truth Be Told / Your campaign
            </p>
            <h1 className="font-head max-w-4xl text-4xl leading-[1.08] tracking-tight break-words sm:text-6xl lg:text-7xl">
              <span className="bg-primary box-decoration-clone px-1">{campaign.name}</span>
            </h1>
            <p className="text-muted-foreground mt-5 text-base">
              {feedback.length} {feedback.length === 1 ? 'response' : 'responses'} · Created{' '}
              {new Date(campaign.created_at).toLocaleDateString()}
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Button onClick={() => setShare('campaign')}>Share campaign</Button>
              <Link href={`/f/c/${campaign.id}`} className={buttonVariants({ variant: 'outline' })}>
                Open feedback page →
              </Link>
            </div>
          </header>
          <div
            className={
              campaign.content
                ? 'grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12'
                : 'max-w-3xl'
            }
          >
            {campaign.content && (
              <CampaignPreview key={campaign.content.url} content={campaign.content} />
            )}
            <section aria-label="Received feedback" className="min-w-0">
              <div className="mb-6 flex items-center justify-between gap-4 border-b-2 border-black pb-4">
                <h2 className="font-head text-3xl">Feedback</h2>
                <span className="font-head bg-primary grid size-10 place-items-center border-2 border-black">
                  {feedback.length}
                </span>
              </div>
              {feedback.length === 0 && (
                <Card className="bg-white">
                  <CardContent className="py-8">
                    <p className="font-head text-2xl">No feedback yet.</p>
                    <p className="mt-3 text-base">
                      Share your link when you’re ready for people to respond.
                    </p>
                  </CardContent>
                </Card>
              )}
              <div className="grid gap-6">
                {feedback.map((item) => (
                  <Card key={item.id} className="min-w-0 bg-white">
                    <CardHeader>
                      <CardTitle className="font-mono text-sm">
                        {new Date(item.created_at).toLocaleString()}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xl leading-relaxed break-words whitespace-pre-wrap">
                        {item.text}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-5"
                        onClick={() => setShare(item)}
                      >
                        Share feedback
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </div>
          {share && (
            <ShareDialog
              key={share === 'campaign' ? 'campaign' : share.id}
              campaign={campaign}
              feedback={share === 'campaign' ? undefined : share}
              onClose={() => setShare(null)}
            />
          )}
        </>
      )}
    </main>
  );
}

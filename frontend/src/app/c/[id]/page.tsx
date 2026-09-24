'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Campaign, Feedback } from '@/lib/api-types';

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setCampaign(null);
    setError('');
    Promise.all([
      fetch(`/api/campaign/${encodeURIComponent(id)}`, { signal: controller.signal }),
      fetch(`/api/feedback?campaign_id=${encodeURIComponent(id)}`, { signal: controller.signal }),
    ])
      .then(async ([campaignResponse, feedbackResponse]) => {
        if (!campaignResponse.ok || !feedbackResponse.ok)
          throw new Error('Could not load campaign');
        return Promise.all([
          campaignResponse.json() as Promise<Campaign>,
          feedbackResponse.json() as Promise<Feedback[]>,
        ]);
      })
      .then(([loadedCampaign, loadedFeedback]) => {
        if (!controller.signal.aborted) {
          setCampaign(loadedCampaign);
          setFeedback(loadedFeedback);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('Could not load this campaign. Refresh the page to try again.');
      });
    return () => controller.abort();
  }, [id]);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-16">
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
          <h1 className="font-head mt-8 text-5xl break-words uppercase sm:text-7xl">
            {campaign.name}
          </h1>
          <p className="mt-4 text-lg">
            {feedback.length} {feedback.length === 1 ? 'response' : 'responses'} · Created{' '}
            {new Date(campaign.created_at).toLocaleDateString()}
          </p>
          <a
            href={`/f/c/${campaign.id}`}
            className="font-head bg-primary mt-5 inline-block border-2 border-black px-4 py-3 shadow-md hover:-translate-y-1"
          >
            Open collection page →
          </a>
          <h2 className="font-head mt-14 mb-6 text-3xl uppercase">Feedback</h2>
          {feedback.length === 0 && (
            <p>No feedback yet. Share the collection page to invite responses.</p>
          )}
          <div className="grid gap-5">
            {feedback.map((item) => (
              <Card key={item.id} className="bg-white">
                <CardHeader>
                  <CardTitle className="font-mono text-sm">
                    {new Date(item.created_at).toLocaleString()}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg break-words whitespace-pre-wrap">{item.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

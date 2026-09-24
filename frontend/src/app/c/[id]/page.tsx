import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getCampaign, listFeedback } from '@/lib/api';

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [campaign, feedback] = await Promise.all([getCampaign(id), listFeedback(id)]);
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-16">
      <Link href="/c" className="font-head text-sm uppercase underline">
        ← All campaigns
      </Link>
      <h1 className="font-head mt-8 text-5xl break-words uppercase sm:text-7xl">{campaign.name}</h1>
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
    </main>
  );
}

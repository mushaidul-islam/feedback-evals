import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listCampaigns } from '@/lib/api';

import { CreateForm } from './create-form';

export default async function CampaignsPage() {
  const campaigns = await listCampaigns();
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
        {campaigns.map((campaign, index) => (
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
      {campaigns.length === 0 && (
        <p className="mt-12 text-lg">No campaigns yet. Create one above to get started.</p>
      )}
    </main>
  );
}

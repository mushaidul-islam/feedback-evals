import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPublicCampaign } from '@/lib/api';

import { FeedbackForm } from './feedback-form';

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await getPublicCampaign(id);
  return (
    <main className="grid min-h-screen place-items-center px-5 py-10 sm:px-8">
      <div className="w-full max-w-3xl">
        <p className="font-head text-sm tracking-widest uppercase">
          Truth Be Told / Anonymous feedback
        </p>
        <h1 className="font-head mt-5 text-5xl uppercase sm:text-7xl">Share your thoughts</h1>
        <Card className="bg-accent mt-10">
          <CardHeader>
            <CardTitle className="font-head text-3xl break-words uppercase sm:text-4xl">
              {campaign.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FeedbackForm campaignId={campaign.id} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

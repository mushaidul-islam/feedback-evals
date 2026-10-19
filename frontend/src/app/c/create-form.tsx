'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import type { Campaign } from '@/lib/api-types';

export function CreateForm() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name') ?? '').trim();
    const contentURL = String(new FormData(event.currentTarget).get('content_url') ?? '').trim();
    const contentType = String(new FormData(event.currentTarget).get('content_type') ?? 'embed');
    if (!name) {
      setMessage('Enter a campaign name.');
      return;
    }
    setPending(true);
    setMessage('');
    try {
      const response = await fetch('/api/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, content_url: contentURL, content_type: contentType }),
      });
      if (!response.ok) {
        setMessage(
          response.status === 400
            ? 'Enter a campaign name and a public HTTPS content link, or leave the link empty.'
            : 'Could not create the campaign. Please try again.',
        );
        setPending(false);
        return;
      }
      const campaign = (await response.json()) as Campaign;
      router.push(`/c/${campaign.id}`);
    } catch {
      setMessage('Could not create the campaign. Please try again.');
      setPending(false);
    }
  }

  return (
    <form onSubmit={create} className="space-y-4" aria-busy={pending}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 sm:flex-[3_1_0%]">
          <label className="font-head mb-2 block text-sm uppercase" htmlFor="campaign-name">
            Campaign name
          </label>
          <Input
            id="campaign-name"
            name="name"
            required
            maxLength={200}
            placeholder="What would you like feedback on?"
            aria-describedby="campaign-name-help"
            className="h-12 bg-white text-base"
          />
        </div>
        <div className="min-w-0 sm:flex-[1_1_0%]">
          <Button
            type="submit"
            size="lg"
            disabled={pending}
            className="h-14 w-full px-3 py-1 leading-5 whitespace-normal hover:translate-x-0 hover:translate-y-0 active:translate-x-0 active:translate-y-0 lg:px-4 lg:py-1"
          >
            {pending ? 'Creating…' : 'Create campaign'}
          </Button>
        </div>
      </div>
      <p id="campaign-name-help" className="text-muted-foreground -mt-2 text-sm">
        For example, “How was my dancing?”
      </p>
      <div>
        <label className="font-head mb-2 block text-sm uppercase" htmlFor="campaign-content-type">
          Content type
        </label>
        <NativeSelect
          id="campaign-content-type"
          name="content_type"
          defaultValue="embed"
          className="mb-4 w-full"
        >
          <NativeSelectOption value="embed">
            Embed — website, social post, or Google Drive
          </NativeSelectOption>
          <NativeSelectOption value="image">Image — direct image link</NativeSelectOption>
          <NativeSelectOption value="video">Video — direct video link</NativeSelectOption>
        </NativeSelect>
        <label className="font-head mb-2 block text-sm uppercase" htmlFor="campaign-content">
          Content link (optional)
        </label>
        <Input
          id="campaign-content"
          name="content_url"
          type="url"
          maxLength={2048}
          placeholder="https://…"
          aria-describedby="campaign-content-help"
          className="h-12 bg-white text-base"
        />
        <p id="campaign-content-help" className="mt-2 text-sm">
          Choose image or video for a direct media link. Use embed for a website, social post, or
          public Google Drive file. Some sites block previews; the original link stays available.
        </p>
      </div>
      {message && (
        <Alert status="error">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}

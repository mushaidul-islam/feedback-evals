'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Campaign } from '@/lib/api-types';

export function CreateForm() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name') ?? '').trim();
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
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error('Could not create campaign');
      const campaign = (await response.json()) as Campaign;
      router.push(`/c/${campaign.id}`);
    } catch {
      setMessage('Could not create the campaign. Please try again.');
      setPending(false);
    }
  }

  return (
    <form onSubmit={create} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label className="font-head mb-2 block text-sm uppercase" htmlFor="campaign-name">
          Campaign name
        </label>
        <Input
          id="campaign-name"
          name="name"
          required
          maxLength={200}
          placeholder="What would you like feedback on?"
          className="h-12 bg-white text-base"
        />
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Creating…' : 'Create campaign'}
      </Button>
      {message && (
        <Alert status="error" className="sm:col-span-2">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}

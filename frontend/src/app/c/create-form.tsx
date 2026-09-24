'use client';

import { useActionState } from 'react';

import { createCampaign } from '@/app/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function CreateForm() {
  const [state, action, pending] = useActionState(createCampaign, { message: '' });
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
      {state.message && (
        <Alert status="error" className="sm:col-span-2">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}

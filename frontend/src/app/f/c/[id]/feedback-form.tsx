'use client';

import { useActionState } from 'react';

import { submitFeedback } from '@/app/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function FeedbackForm({ campaignId }: { campaignId: string }) {
  const [state, action, pending] = useActionState(submitFeedback.bind(null, campaignId), {
    message: '',
  });
  if (state.sent)
    return (
      <Alert status="success">
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  return (
    <form action={action} className="space-y-5">
      <label htmlFor="feedback-text" className="font-head block text-lg uppercase">
        Your feedback
      </label>
      <Textarea
        id="feedback-text"
        name="text"
        required
        minLength={10}
        aria-describedby={state.message ? 'feedback-error' : undefined}
        className="min-h-52 bg-white p-4 text-xl"
        placeholder="Tell them what you think…"
      />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Sending…' : 'Send anonymously →'}
      </Button>
      {state.message && (
        <Alert id="feedback-error" status="error">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}

'use client';

import { useState, type FormEvent } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function FeedbackForm({ campaignId }: { campaignId: string }) {
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = String(new FormData(event.currentTarget).get('text') ?? '');
    if ([...text.trim()].length < 10) {
      setMessage('Write at least 10 characters.');
      return;
    }
    void fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: campaignId, text }),
    }).catch(() => undefined);
    setSent(true);
  }

  if (sent)
    return (
      <Alert status="success">
        <AlertDescription>Your feedback was sent.</AlertDescription>
      </Alert>
    );
  return (
    <form
      onSubmit={submit}
      className="border-border bg-accent relative border-2 p-3 shadow-xl sm:p-4"
    >
      <Textarea
        aria-label="Feedback"
        name="text"
        required
        aria-describedby={message ? 'feedback-error' : undefined}
        className="border-border h-44 resize-none border-2 px-4 py-4 pr-18 font-sans text-xl leading-tight font-semibold sm:h-52 sm:px-5 sm:py-5 sm:pr-22 sm:text-2xl"
        placeholder=""
      />
      <Button
        aria-label="Send feedback"
        className="absolute right-6 bottom-6 size-14 p-0 text-4xl leading-none sm:right-8 sm:bottom-8 sm:size-16"
        size="icon-lg"
        type="submit"
      >
        <span aria-hidden="true">→</span>
      </Button>
      {message && (
        <p id="feedback-error" className="mt-3 font-bold text-black">
          {message}
        </p>
      )}
    </form>
  );
}

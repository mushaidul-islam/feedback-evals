'use client';

import { useId, useState } from 'react';

import { CampaignContent } from '@/components/campaign-content';
import { Button } from '@/components/ui/button';
import type { CampaignContent as Content } from '@/lib/api-types';

export function CampaignPreview({ content }: { content: Content }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div className="min-w-0">
      <Button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="w-full justify-between px-4 py-4 lg:hidden"
      >
        <span>
          {open ? 'Hide content' : 'View content'}{' '}
          <span className="font-sans text-sm">/ {content.provider}</span>
        </span>
        <span
          aria-hidden="true"
          className={`text-xl transition-transform motion-reduce:transition-none ${open ? 'rotate-45' : ''}`}
        >
          +
        </span>
      </Button>
      <div
        id={id}
        className={`grid transition-[grid-template-rows,visibility] duration-300 ease-out motion-reduce:transition-none lg:visible lg:grid-rows-[1fr] ${open ? 'visible grid-rows-[1fr]' : 'invisible grid-rows-[0fr]'}`}
      >
        <div className="min-h-0 overflow-hidden">
          <CampaignContent content={content} />
        </div>
      </div>
    </div>
  );
}

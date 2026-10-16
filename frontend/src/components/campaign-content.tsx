'use client';

import Script from 'next/script';
import { useRef, useState } from 'react';

import type { CampaignContent as Content } from '@/lib/api-types';

type EmbedWindow = Window & {
  instgrm?: { Embeds: { process: () => void } };
  twttr?: { widgets: { load: (container: HTMLElement) => void } };
};

export function CampaignContent({ content }: { content: Content }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  return (
    <section aria-label="Campaign content" className="mt-5 min-w-0 lg:mt-0">
      {content.provider === 'X' ? (
        <div ref={container}>
          <blockquote className="twitter-tweet" data-width="550" data-dnt="true">
            <a href={content.url}>View post on X</a>
          </blockquote>
          <Script
            src="https://platform.twitter.com/widgets.js"
            strategy="afterInteractive"
            onReady={() => {
              if (container.current) (window as EmbedWindow).twttr?.widgets.load(container.current);
            }}
            onError={() => setFailed(true)}
          />
        </div>
      ) : content.provider === 'Instagram' && !failed ? (
        <div className="mx-auto max-w-[540px] [&_iframe]:!w-full [&_iframe]:!min-w-0">
          <blockquote
            className="instagram-media w-full"
            data-instgrm-permalink={content.url}
            data-instgrm-version="14"
          >
            <a href={content.url} target="_blank" rel="noopener noreferrer">
              View post on Instagram
            </a>
          </blockquote>
          <Script
            src="https://www.instagram.com/embed.js"
            strategy="afterInteractive"
            onReady={() => (window as EmbedWindow).instgrm?.Embeds.process()}
            onError={() => setFailed(true)}
          />
        </div>
      ) : content.embed_url && !failed ? (
        <iframe
          src={content.embed_url}
          title={`${content.provider} content`}
          loading="lazy"
          allow="encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          onError={() => setFailed(true)}
          className={`w-full border-2 border-black bg-white ${
            content.provider === 'YouTube'
              ? 'aspect-video'
              : content.provider === 'TikTok'
                ? 'mx-auto aspect-[9/16] min-h-[580px] max-w-[360px]'
                : content.provider === 'Facebook'
                  ? 'aspect-[9/16] min-h-[600px]'
                  : 'h-[760px]'
          }`}
        />
      ) : null}
      <p className="mt-3 text-sm">
        {failed || (!content.embed_url && content.provider !== 'X')
          ? 'Preview unavailable. '
          : 'If the preview does not load, '}
        <a href={content.url} target="_blank" rel="noopener noreferrer" className="underline">
          Open original on {content.provider}
        </a>
        .
      </p>
    </section>
  );
}

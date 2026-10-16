'use client';

import { useEffect, useRef, useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Campaign, Feedback } from '@/lib/api-types';
import { createShareCard } from '@/lib/share-card';

export function ShareDialog({
  campaign,
  feedback,
  onClose,
}: {
  campaign: Campaign;
  feedback?: Feedback;
  onClose: () => void;
}) {
  const [text, setText] = useState(feedback?.text ?? campaign.name);
  const [image, setImage] = useState<{ url: string; file: File } | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [sharing, setSharing] = useState(false);
  const linkInput = useRef<HTMLInputElement>(null);
  const url = `${window.location.origin}/f/c/${encodeURIComponent(campaign.id)}`;
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  const shareText = feedback
    ? `Here's feedback I received on “${campaign.name}”. Leave your own anonymous feedback:`
    : `${campaign.name}\nLeave me honest, anonymous feedback.`;
  const xURL = `https://x.com/intent/tweet?${new URLSearchParams({ text: shareText, url })}`;
  const whatsappURL = `https://wa.me/?${new URLSearchParams({ text: `${shareText}\n${url}` })}`;

  useEffect(() => {
    let cancelled = false;
    let objectURL: string | undefined;
    setImage(null);
    setError('');
    if (!text.trim()) {
      setError('Add some text for the image.');
      return;
    }
    createShareCard(campaign.name, text, url, !!feedback)
      .then((blob) => {
        if (cancelled) return;
        objectURL = URL.createObjectURL(blob);
        const file = new File(
          [blob],
          `${feedback ? 'feedback' : 'campaign'}-${feedback?.id ?? campaign.id}.png`,
          { type: 'image/png' },
        );
        setImage({ url: objectURL, file });
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(
            cause instanceof Error ? cause.message : 'Could not create the image. Try again.',
          );
      });
    return () => {
      cancelled = true;
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [campaign.id, campaign.name, feedback, text, url]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Link copied. Paste it into your post or story link sticker.');
    } catch {
      linkInput.current?.focus();
      linkInput.current?.select();
      setStatus('Select and copy the collection link above.');
    }
  }

  async function share(withImage: boolean) {
    setSharing(true);
    setStatus('');
    try {
      // The file is prepared before the click so mobile user activation is preserved.
      await navigator.share(
        withImage && image
          ? { files: [image.file], title: campaign.name }
          : { title: campaign.name, text: 'Leave me honest, anonymous feedback.', url },
      );
      setStatus('Share sheet closed. You can share again or download the image.');
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
        setStatus('Sharing is unavailable here. Download the image or copy the link instead.');
      }
    } finally {
      setSharing(false);
    }
  }

  let canShareImage = false;
  try {
    canShareImage = !!image && !!navigator.share && !!navigator.canShare?.({ files: [image.file] });
  } catch {
    /* Browsers may deny file sharing; download remains available. */
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="bg-background max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:max-w-3xl sm:p-7">
        <DialogTitle className="pr-8 text-2xl leading-tight">
          {feedback ? 'Share this feedback' : 'Share your campaign'}
        </DialogTitle>
        <DialogDescription>
          Made for your story. A QR code brings people back to your collection page.
        </DialogDescription>
        <div className="grid min-w-0 gap-6 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            {image ? (
              // A local blob preview uses the exact PNG that is downloaded and shared.
              // oxlint-disable-next-line nextjs/no-img-element
              <img
                src={image.url}
                alt="Share card preview"
                className="mx-auto max-h-[50dvh] w-auto max-w-full border-2 border-black shadow-md sm:max-h-[65dvh]"
              />
            ) : (
              <div
                role="status"
                className="bg-primary grid min-h-40 place-items-center border-2 border-black p-6 text-center"
              >
                {error ? 'Adjust the text to create your card.' : 'Making your image…'}
              </div>
            )}
          </div>
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap gap-3">
              {canShareImage && (
                <Button disabled={sharing || !image} onClick={() => void share(true)}>
                  Share image
                </Button>
              )}
              {image && (
                <a
                  href={image.url}
                  download={image.file.name}
                  className={buttonVariants({ variant: canShareImage ? 'outline' : 'default' })}
                >
                  Download image
                </a>
              )}
            </div>
            <div>
              <label htmlFor="share-collection-link" className="font-head mb-2 block text-sm">
                Collection link
              </label>
              <Input
                ref={linkInput}
                id="share-collection-link"
                value={url}
                readOnly
                onFocus={(event) => event.target.select()}
                className="w-full min-w-0 bg-white"
              />
              <div className="mt-3 flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => void copyLink()}>
                  Copy link
                </Button>
                {typeof navigator.share === 'function' && (
                  <Button variant="outline" disabled={sharing} onClick={() => void share(false)}>
                    Share link
                  </Button>
                )}
              </div>
              <p className="mt-4 text-sm">Or share the link on:</p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm underline">
                <a href={xURL} target="_blank" rel="noopener noreferrer">
                  X
                </a>
                <a href={whatsappURL} target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
              </div>
              <p className="mt-2 text-xs">
                To include your card, attach the downloaded image in the composer.
              </p>
            </div>
            <p className="text-sm">
              For Instagram or TikTok: share the image through your phone’s share sheet, or save it
              and add it to your story. Add the copied collection link as a link sticker where
              available. Links inside an image are not tappable.
            </p>
            {feedback && (
              <p className="text-sm">
                Only this feedback is included. Review the preview before sharing it publicly.
              </p>
            )}
            {isLocal && (
              <p className="text-sm font-semibold">
                Local preview: this link and QR only open on this computer. Use your published site
                when sharing with others.
              </p>
            )}
            <details>
              <summary className="cursor-pointer text-sm underline">Edit image text</summary>
              <label htmlFor="share-image-text" className="mt-3 mb-2 block text-sm">
                Text on image
              </label>
              <Textarea
                id="share-image-text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                className="min-h-28 w-full bg-white"
              />
              <p className="mt-2 text-xs">Changes affect this image only.</p>
            </details>
            {error && (
              <p role="alert" className="text-sm font-semibold">
                {error}
              </p>
            )}
            <p role="status" aria-live="polite" className="text-sm">
              {status}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

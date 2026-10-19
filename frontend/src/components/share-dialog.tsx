'use client';

import { Copy, Download, Share2 } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { ShareStamp } from '@/components/share-stamp';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { Campaign, Feedback } from '@/lib/api-types';
import { createShareCard } from '@/lib/share-card';
import { shareCardStore, type StoredShareCard } from '@/lib/share-card-store';

export function ShareDialog({
  campaign,
  feedback,
  onClose,
}: {
  campaign: Campaign;
  feedback?: Feedback;
  onClose: () => void;
}) {
  const text = feedback?.text ?? campaign.name;
  const [image, setImage] = useState<{ url: string; file: File } | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [sharing, setSharing] = useState(false);
  const [stamp, setStamp] = useState<Blob | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [storageStatus, setStorageStatus] = useState('');
  const [savingStamp, setSavingStamp] = useState(false);
  const cached = useRef<StoredShareCard | undefined>(undefined);
  const generation = useRef(0);
  const linkInput = useRef<HTMLInputElement>(null);
  const url = `${window.location.origin}/f/c/${encodeURIComponent(campaign.id)}`;
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  const shareText = feedback
    ? `Here's feedback I received on “${campaign.name}”. You can leave feedback here:`
    : `${campaign.name}\nYou can leave feedback anonymously.`;
  const xURL = `https://x.com/intent/tweet?${new URLSearchParams({ text: shareText, url })}`;
  const whatsappURL = `https://wa.me/?${new URLSearchParams({ text: `${shareText}\n${url}` })}`;
  const storageKey = `${campaign.id}:${feedback?.id ?? 'campaign'}`;
  // Regenerate saved cards from the previous source-panel layout, retaining uploads.
  const signature = JSON.stringify(['postage-stamp', campaign.name, text, url]);

  useEffect(() => {
    let cancelled = false;
    shareCardStore(storageKey)
      .then((saved) => {
        if (cancelled) return;
        cached.current = saved;
        setStamp(saved?.stamp ?? null);
      })
      .catch(() => {
        if (!cancelled)
          setStorageStatus(
            'Local storage is unavailable. You can still download or share the image.',
          );
      })
      .finally(() => {
        if (!cancelled) setStorageReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!storageReady) return;
    let cancelled = false;
    const revision = generation.current;
    let objectURL: string | undefined;
    setImage(null);
    setError('');
    if (!text.trim()) {
      setError('There is no text to share.');
      return;
    }
    const saved = cached.current;
    const reusable = saved?.signature === signature && saved.stamp === stamp;
    (reusable
      ? Promise.resolve(saved.card)
      : createShareCard(campaign.name, text, url, !!feedback, stamp)
    )
      .then(async (blob) => {
        if (cancelled || revision !== generation.current) return;
        objectURL = URL.createObjectURL(blob);
        const file = new File(
          [blob],
          `${feedback ? 'feedback' : 'campaign'}-${feedback?.id ?? campaign.id}.png`,
          { type: 'image/png' },
        );
        setImage({ url: objectURL, file });
        if (!reusable) {
          const value = { signature, stamp, card: blob };
          try {
            await shareCardStore(storageKey, value);
            if (!cancelled && revision === generation.current) {
              cached.current = value;
              setStorageStatus('Image saved on this device.');
            }
          } catch {
            if (!cancelled && revision === generation.current)
              setStorageStatus(
                'Local storage is unavailable. You can still download or share the image.',
              );
          }
        } else setStorageStatus('Image saved on this device.');
      })
      .catch((cause: unknown) => {
        if (!cancelled && revision === generation.current)
          setError(
            cause instanceof Error ? cause.message : 'Could not create the image. Try again.',
          );
      });
    return () => {
      cancelled = true;
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [campaign.id, campaign.name, feedback, text, url, stamp, storageReady, storageKey, signature]);

  async function changeStamp(next: Blob | null) {
    if (savingStamp) return;
    setSavingStamp(true);
    generation.current++;
    setImage(null);
    setStorageStatus('Saving stamp…');
    // Persist the choice before slow thumbnail loading or card generation.
    // An empty signature forces regeneration if the page reloads mid-render.
    const value = { signature: '', stamp: next, card: image?.file ?? new Blob() };
    try {
      await shareCardStore(storageKey, value);
    } catch {
      // Export still works when storage is blocked or full.
    }
    cached.current = value;
    setStamp(next);
    setSavingStamp(false);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Link copied. Paste it into your post or story link sticker.');
    } catch {
      linkInput.current?.focus();
      linkInput.current?.select();
      setStatus('Select and copy the feedback link above.');
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
          : { title: campaign.name, text: 'You can leave feedback anonymously.', url },
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
          Share the image or copy the link. The QR code opens your feedback page.
        </DialogDescription>
        <div className="grid min-w-0 gap-6 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            {image ? (
              <div className="relative mx-auto w-fit max-w-full">
                {/* Render the exact local PNG without sending it to an image optimizer. */}
                <Image
                  src={image.url}
                  alt="Share card preview"
                  width={1080}
                  height={1920}
                  unoptimized
                  className="mx-auto h-auto max-h-[50dvh] w-auto max-w-full border-2 border-black shadow-md sm:max-h-[65dvh]"
                />
                <div
                  className="absolute top-3 right-3 flex gap-2"
                  role="group"
                  aria-label="Image sharing actions"
                >
                  <a
                    href={image.url}
                    download={image.file.name}
                    aria-label="Download image"
                    title="Download image"
                    className={buttonVariants({
                      size: 'icon-sm',
                      className: 'size-9 pointer-coarse:size-11',
                    })}
                  >
                    <Download aria-hidden="true" className="size-4" />
                  </a>
                  <Button
                    size="icon-sm"
                    className="size-9 pointer-coarse:size-11"
                    disabled={sharing}
                    aria-label={canShareImage ? 'Share image' : 'Share link'}
                    title={canShareImage ? 'Share image' : 'Share link'}
                    onClick={() => {
                      if (typeof navigator.share === 'function') void share(canShareImage);
                      else void copyLink();
                    }}
                  >
                    <Share2 aria-hidden="true" className="size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div
                role="status"
                className="bg-primary grid min-h-40 place-items-center border-2 border-black p-6 text-center"
              >
                {error ? 'The image could not be created.' : 'Making your image…'}
              </div>
            )}
          </div>
          <div className="min-w-0 space-y-4">
            {storageReady && (
              <ShareStamp
                hasStamp={!!stamp}
                disabled={savingStamp}
                onApply={(blob) => {
                  void changeStamp(blob);
                }}
                onRemove={() => {
                  void changeStamp(null);
                }}
              />
            )}
            <p role="status" aria-live="polite" className="text-sm">
              {storageStatus}
            </p>
            <div>
              <label htmlFor="share-collection-link" className="font-head mb-2 block text-sm">
                Feedback link
              </label>
              <div className="relative">
                <Input
                  ref={linkInput}
                  id="share-collection-link"
                  value={url}
                  readOnly
                  onFocus={(event) => event.target.select()}
                  className="h-12 w-full min-w-0 bg-white pr-14"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-1/2 right-1 size-10 -translate-y-1/2"
                  aria-label="Copy link"
                  title="Copy link"
                  onClick={() => void copyLink()}
                >
                  <Copy aria-hidden="true" className="size-4" />
                </Button>
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
              <p className="mt-2 text-xs">You can attach the downloaded image to your post.</p>
            </div>
            <p className="text-sm">
              For Instagram or TikTok: share the image through your phone’s share sheet, or save it
              and add it to your story. Add the copied feedback link as a link sticker where
              available. Links inside an image are not tappable.
            </p>
            {feedback && (
              <p className="text-sm">
                Long responses are shortened to fit the image. Your saved feedback stays unchanged.
              </p>
            )}
            {isLocal && (
              <p className="text-sm font-semibold">
                Local preview: this link and QR only open on this computer. Use your published site
                when sharing with others.
              </p>
            )}
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

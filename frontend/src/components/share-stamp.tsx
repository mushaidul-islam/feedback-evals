'use client';

import { useEffect, useRef, useState } from 'react';

import { StampExample } from '@/components/stamp-example';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

export function ShareStamp({
  hasStamp,
  disabled,
  onApply,
  onRemove,
}: {
  hasStamp: boolean;
  disabled: boolean;
  onApply: (stamp: Blob) => void;
  onRemove: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const selection = useRef(0);
  const [source, setSource] = useState<ImageBitmap | null>(null);
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => () => source?.close(), [source]);
  useEffect(
    () => () => {
      selection.current++;
    },
    [],
  );

  useEffect(() => {
    if (!source || !canvas.current) return;
    const context = canvas.current.getContext('2d');
    if (!context) return;
    const width = Math.min(source.width, (source.height * 4) / 5) / zoom;
    const height = (width * 5) / 4;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 320, 400);
    context.drawImage(
      source,
      ((source.width - width) * x) / 100,
      ((source.height - height) * y) / 100,
      width,
      height,
      0,
      0,
      320,
      400,
    );
  }, [source, zoom, x, y]);

  async function choose(file?: File) {
    if (!file) return;
    const current = ++selection.current;
    setError('');
    setLoading(false);
    if (
      !['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      setError('Choose a PNG, JPEG, WebP, GIF, or AVIF image up to 10 MB.');
      return;
    }
    setLoading(true);
    try {
      const bitmap = await createImageBitmap(file);
      if (current !== selection.current) {
        bitmap.close();
        return;
      }
      if (bitmap.width * bitmap.height > 40_000_000) {
        bitmap.close();
        throw new Error('Choose an image smaller than 40 megapixels.');
      }
      setSource(bitmap);
      setZoom(1);
      setX(50);
      setY(50);
    } catch (cause) {
      if (current === selection.current)
        setError(cause instanceof Error ? cause.message : 'This image could not be opened.');
    } finally {
      if (current === selection.current) setLoading(false);
    }
  }

  function apply() {
    canvas.current?.toBlob((blob) => {
      if (!blob) {
        setError('Could not crop this image. Try another image.');
        return;
      }
      onApply(blob);
      setSource(null);
    }, 'image/png');
  }

  return (
    <section aria-label="Share image stamp" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="share-stamp" className="font-head block text-sm">
          Stamp image
        </label>
        <StampExample />
      </div>
      <Input
        id="share-stamp"
        type="file"
        disabled={disabled}
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        className="h-auto bg-white"
        onChange={(event) => {
          void choose(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <p className="text-sm">
        Add a screenshot or image to this share card. It stays on this device.
      </p>
      {loading && <p role="status">Opening image…</p>}
      {source && (
        <div className="space-y-4">
          <canvas
            ref={canvas}
            width={320}
            height={400}
            role="img"
            aria-label="Stamp crop preview"
            className="mx-auto aspect-[4/5] w-full max-w-64 border-2 border-black bg-white"
          />
          <div className="space-y-2">
            <span className="text-sm">Zoom</span>
            <Slider
              aria-label="Zoom"
              min={1}
              max={4}
              step={0.05}
              value={[zoom]}
              onValueChange={(value) => setZoom(Array.isArray(value) ? value[0] : value)}
            />
          </div>
          <div className="space-y-2">
            <span className="text-sm">Horizontal position</span>
            <Slider
              aria-label="Horizontal position"
              min={0}
              max={100}
              value={[x]}
              onValueChange={(value) => setX(Array.isArray(value) ? value[0] : value)}
            />
          </div>
          <div className="space-y-2">
            <span className="text-sm">Vertical position</span>
            <Slider
              aria-label="Vertical position"
              min={0}
              max={100}
              value={[y]}
              onValueChange={(value) => setY(Array.isArray(value) ? value[0] : value)}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button disabled={loading || disabled} onClick={apply}>
              Apply stamp
            </Button>
            <Button
              variant="outline"
              disabled={disabled}
              onClick={() => {
                selection.current++;
                setLoading(false);
                setSource(null);
              }}
            >
              Cancel crop
            </Button>
          </div>
        </div>
      )}
      {hasStamp && (
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => {
            selection.current++;
            setLoading(false);
            setSource(null);
            onRemove();
          }}
        >
          Remove stamp
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
    </section>
  );
}

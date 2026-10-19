'use client';

import { ZoomIn } from 'lucide-react';
import Image from 'next/image';
import { useRef, useState, type CSSProperties } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function StampExample() {
  const thumbnail = useRef<HTMLImageElement>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0, scale: 1 });

  function measureOrigin() {
    const bounds = thumbnail.current?.getBoundingClientRect();
    if (!bounds) return;
    const width = Math.min(window.innerWidth - 32, (window.innerHeight * 0.8 * 606) / 1060);
    setOrigin({
      x: bounds.left + bounds.width / 2 - window.innerWidth / 2,
      y: bounds.top + bounds.height / 2 - window.innerHeight / 2,
      scale: bounds.width / width,
    });
  }

  return (
    <Dialog>
      <DialogTrigger
        onClick={measureOrigin}
        onMouseDown={(event) => {
          // Prevent double-click word selection, retaining normal first-click focus.
          if (event.button === 0 && event.detail > 1) event.preventDefault();
        }}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        className="select-none [&_*]:select-none"
        render={<Button variant="ghost" className="group gap-2 p-0 text-left text-xs" />}
        aria-label="View stamp example"
        title="Enlarge stamp example"
      >
        <span className="relative block shrink-0">
          <Image
            ref={thumbnail}
            src="/stamp-example.png"
            alt=""
            width={606}
            height={1060}
            unoptimized
            draggable={false}
            className="w-12 border border-black shadow-sm transition-transform group-hover:scale-105 motion-reduce:transition-none"
          />
          <span className="bg-primary absolute -right-1 -bottom-1 border border-black p-1">
            <ZoomIn aria-hidden="true" className="size-3" />
          </span>
        </span>
        <span className="max-w-20 whitespace-normal underline underline-offset-2">
          See stamp example
        </span>
      </DialogTrigger>
      <DialogContent
        className="max-w-none gap-0 border-0 bg-transparent p-0 shadow-none transition-transform duration-300 ease-out data-closed:animate-none data-open:animate-none data-[ending-style]:[transform:translate(var(--example-x),var(--example-y))_scale(var(--example-scale))] data-[starting-style]:[transform:translate(var(--example-x),var(--example-y))_scale(var(--example-scale))] motion-reduce:transition-none sm:max-w-none"
        style={
          {
            width: 'min(calc(100vw - 2rem), calc(80dvh * 606 / 1060))',
            '--example-x': `${origin.x}px`,
            '--example-y': `${origin.y}px`,
            '--example-scale': origin.scale,
          } as CSSProperties
        }
      >
        <DialogTitle className="sr-only">Stamp example</DialogTitle>
        <DialogDescription className="sr-only">
          An example share card with a tilted photo stamp. Click outside the image or press Escape
          to return.
        </DialogDescription>
        <Image
          src="/stamp-example.png"
          alt="Example share card asking how Nido looks, with a tilted cat photo postage stamp and feedback QR code."
          width={606}
          height={1060}
          unoptimized
          className="h-auto w-full"
        />
      </DialogContent>
    </Dialog>
  );
}

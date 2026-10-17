import { getImageProps } from 'next/image';
import QRCode from 'qrcode';

import type { CampaignContent } from './api-types';

// All rendering happens locally. Private feedback is never sent to an image service.
export async function createShareCard(
  question: string,
  text: string,
  url: string,
  feedback: boolean,
  content?: CampaignContent,
): Promise<Blob> {
  await document.fonts.ready;
  let thumbnail: ImageBitmap | null = null;
  const videoID =
    content?.provider === 'YouTube'
      ? content.embed_url?.match(/^https:\/\/www\.youtube\.com\/embed\/([\w-]{11})(?:\?|$)/)?.[1]
      : undefined;
  if (videoID) {
    try {
      const { props } = getImageProps({
        src: `https://i.ytimg.com/vi/${videoID}/hqdefault.jpg`,
        alt: '',
        width: 320,
        height: 180,
      });
      const response = await fetch(props.src, { signal: AbortSignal.timeout(5000) });
      if (response.ok) thumbnail = await createImageBitmap(await response.blob());
    } catch {
      // A missing or blocked public thumbnail must not prevent exporting feedback.
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not create the image.');
  const style = getComputedStyle(document.documentElement);
  const displayFont = style.getPropertyValue('--font-archivo').trim() || 'sans-serif';
  const bodyFont = style.getPropertyValue('--font-space').trim() || 'sans-serif';

  function box(x: number, y: number, width: number, height: number, color: string) {
    ctx!.fillStyle = '#000';
    ctx!.fillRect(x + 14, y + 14, width, height);
    ctx!.fillStyle = color;
    ctx!.fillRect(x, y, width, height);
    ctx!.strokeStyle = '#000';
    ctx!.lineWidth = 4;
    ctx!.strokeRect(x, y, width, height);
  }

  function fitText(
    value: string,
    x: number,
    y: number,
    width: number,
    height: number,
    maxSize: number,
    font: string,
    centered = false,
  ) {
    ctx!.font = `${maxSize}px ${font}`;
    const lines: string[] = [];
    // Wrap long words without splitting Unicode code points.
    for (const paragraph of value.split('\n')) {
      let line = '';
      for (const word of paragraph.split(/(\s+)/)) {
        if (ctx!.measureText(line + word).width <= width) {
          line += word;
        } else {
          if (line.trim()) lines.push(line.trimEnd());
          line = '';
          for (const character of Array.from(word.trimStart())) {
            if (ctx!.measureText(line + character).width > width && line) {
              lines.push(line);
              line = '';
            }
            line += character;
          }
        }
      }
      lines.push(line.trimEnd());
    }
    const lineHeight = maxSize * 1.25;
    const maxLines = Math.max(1, Math.floor(height / lineHeight));
    const visible = lines.slice(0, maxLines);
    if (lines.length > maxLines) {
      const last = Array.from(visible[maxLines - 1].trimEnd());
      while (last.length && ctx!.measureText(last.join('') + '…').width > width) last.pop();
      visible[maxLines - 1] = last.join('').trimEnd() + '…';
    }
    ctx!.fillStyle = '#000';
    ctx!.textBaseline = 'top';
    const top = centered ? y + (height - visible.length * lineHeight) / 2 : y;
    visible.forEach((line, index) => ctx!.fillText(line, x, top + index * lineHeight));
  }

  ctx.fillStyle = '#fff7e8';
  ctx.fillRect(0, 0, 1080, 1920);
  box(76, 130, 928, 80, '#ffdc58');
  fitText('TRUTH BE TOLD / ANONYMOUS FEEDBACK', 102, 155, 880, 45, 28, displayFont);
  fitText(
    feedback ? 'Feedback received' : 'What do you think?',
    80,
    270,
    920,
    130,
    72,
    displayFont,
  );
  if (feedback) {
    fitText(question, 84, 420, 910, 180, 42, displayFont);
  } else {
    fitText('You can reply anonymously.', 84, 410, 910, 60, 34, bodyFont);
  }
  box(
    80,
    feedback ? 640 : 540,
    920,
    (feedback ? 660 : 760) - (content ? 140 : 0),
    feedback ? '#fff' : '#ffdc58',
  );
  fitText(
    text,
    130,
    feedback ? 695 : 600,
    820,
    (feedback ? 550 : 640) - (content ? 140 : 0),
    feedback ? 62 : 84,
    feedback ? bodyFont : displayFont,
    true,
  );
  if (content) {
    box(80, 1200, 920, 160, '#fff');
    if (thumbnail) {
      const cropHeight = Math.min(thumbnail.height, (thumbnail.width * 9) / 16);
      ctx.drawImage(
        thumbnail,
        0,
        (thumbnail.height - cropHeight) / 2,
        thumbnail.width,
        cropHeight,
        100,
        1220,
        210,
        118,
      );
      thumbnail.close();
    }
    const left = thumbnail ? 340 : 110;
    fitText(
      `Linked ${content.provider === 'YouTube' ? 'video' : 'post'} on ${content.provider}`,
      left,
      1230,
      970 - left,
      50,
      30,
      displayFont,
    );
    fitText(new URL(content.url).hostname, left, 1290, 970 - left, 40, 24, bodyFont);
  }
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, url, { width: 300, margin: 4, errorCorrectionLevel: 'M' });
  box(80, 1400, 300, 300, '#fff');
  ctx.drawImage(qr, 80, 1400);
  fitText('Leave feedback', 435, 1440, 560, 90, 48, displayFont);
  fitText('Scan to open the link and\nreply anonymously.', 435, 1550, 550, 140, 32, bodyFont);
  fitText(url, 84, 1760, 912, 100, 24, bodyFont);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('Could not export the image. Try again.')),
      'image/png',
    ),
  );
}

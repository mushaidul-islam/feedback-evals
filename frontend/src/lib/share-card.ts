import QRCode from 'qrcode';

// All rendering happens locally. Private feedback is never sent to an image service.
export async function createShareCard(
  question: string,
  text: string,
  url: string,
  feedback: boolean,
): Promise<Blob> {
  await document.fonts.ready;
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
    // Wrap even a single long word, preserving explicit line breaks and Unicode characters.
    for (let size = maxSize; size >= 22; size -= 2) {
      ctx!.font = `${size}px ${font}`;
      const lines: string[] = [];
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
      const lineHeight = size * 1.25;
      if (lines.length * lineHeight <= height) {
        ctx!.fillStyle = '#000';
        ctx!.textBaseline = 'top';
        const top = centered ? y + (height - lines.length * lineHeight) / 2 : y;
        lines.forEach((line, index) => ctx!.fillText(line, x, top + index * lineHeight));
        return;
      }
    }
    throw new Error('This text is too long for one image. Shorten the image text below.');
  }

  ctx.fillStyle = '#fff7e8';
  ctx.fillRect(0, 0, 1080, 1920);
  box(76, 130, 928, 80, '#ffdc58');
  fitText('TRUTH BE TOLD / ANONYMOUS FEEDBACK', 102, 155, 880, 45, 28, displayFont);
  fitText(feedback ? 'THE FEEDBACK.' : 'BE HONEST.', 80, 270, 920, 130, 96, displayFont);
  if (feedback) {
    fitText(question, 84, 420, 910, 180, 42, displayFont);
  } else {
    fitText('NO NAME ATTACHED.', 84, 410, 910, 60, 34, bodyFont);
  }
  box(80, feedback ? 640 : 540, 920, feedback ? 660 : 760, feedback ? '#fff' : '#ffdc58');
  fitText(
    text,
    130,
    feedback ? 695 : 600,
    820,
    feedback ? 550 : 640,
    feedback ? 62 : 84,
    feedback ? bodyFont : displayFont,
    true,
  );
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, url, { width: 300, margin: 4, errorCorrectionLevel: 'M' });
  box(80, 1400, 300, 300, '#fff');
  ctx.drawImage(qr, 80, 1400);
  fitText('YOUR TURN.', 435, 1440, 560, 90, 58, displayFont);
  fitText('Scan to leave\nanonymous feedback →', 435, 1550, 550, 140, 32, bodyFont);
  fitText(url, 84, 1760, 912, 100, 24, bodyFont);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('Could not export the image. Try again.')),
      'image/png',
    ),
  );
}

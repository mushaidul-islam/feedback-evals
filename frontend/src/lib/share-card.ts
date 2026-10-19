import QRCode from 'qrcode';

// All rendering happens locally. Private feedback is never sent to an image service.
export async function createShareCard(
  question: string,
  text: string,
  url: string,
  feedback: boolean,
  stamp?: Blob | null,
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
  box(80, feedback ? 640 : 540, 920, feedback ? 660 : 760, feedback ? '#fff' : '#ffdc58');
  fitText(
    text,
    130,
    feedback ? 695 : 600,
    820,
    stamp ? (feedback ? 255 : 350) : feedback ? 550 : 640,
    feedback ? 62 : 84,
    feedback ? bodyFont : displayFont,
    true,
  );
  if (stamp) {
    const image = await createImageBitmap(stamp);
    try {
      ctx.save();
      ctx.translate(825, 1190);
      ctx.rotate((-8 * Math.PI) / 180);
      ctx.fillStyle = '#000';
      ctx.fillRect(-150, -185, 320, 390);
      // Clip edge holes out of the stamp, without erasing the card underneath.
      ctx.beginPath();
      ctx.rect(-160, -195, 320, 390);
      ctx.clip();
      const edge = new Path2D();
      edge.rect(-160, -195, 320, 390);
      for (let x = -149; x < 160; x += 22) {
        for (const y of [-195, 195]) {
          edge.moveTo(x + 6, y);
          edge.arc(x, y, 6, 0, Math.PI * 2);
          edge.closePath();
        }
      }
      for (let y = -184; y < 195; y += 22) {
        for (const x of [-160, 160]) {
          edge.moveTo(x + 6, y);
          edge.arc(x, y, 6, 0, Math.PI * 2);
          edge.closePath();
        }
      }
      ctx.clip(edge, 'evenodd');
      ctx.fillStyle = '#fff7e8';
      ctx.fillRect(-160, -195, 320, 390);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 5;
      ctx.stroke(edge);
      ctx.fillStyle = '#fff';
      ctx.fillRect(-140, -175, 280, 350);
      // Center-crop older landscape stamps as well as new portrait uploads.
      const width = Math.min(image.width, (image.height * 4) / 5);
      const height = (width * 5) / 4;
      ctx.drawImage(
        image,
        (image.width - width) / 2,
        (image.height - height) / 2,
        width,
        height,
        -140,
        -175,
        280,
        350,
      );
      ctx.strokeRect(-140, -175, 280, 350);
      ctx.restore();
    } finally {
      image.close();
    }
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

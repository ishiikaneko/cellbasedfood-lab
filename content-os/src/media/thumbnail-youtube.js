import { createCanvas, loadImage } from '@napi-rs/canvas';
import sharp from 'sharp';
import fs from 'fs';
import { log } from '../utils/logger.js';

const W = 1280;
const H = 720;
const PADDING = 48;
const MAX_TEXT_WIDTH = W - PADDING * 2;

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export async function generateYouTubeThumbnail(hookImagePath, title, outputPath) {
  // Scale and crop hook image to 1280×720
  const bgBuffer = await sharp(hookImagePath)
    .resize(W, H, { fit: 'cover', position: 'center' })
    .toBuffer();

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background image
  const bg = await loadImage(bgBuffer);
  ctx.drawImage(bg, 0, 0, W, H);

  // Gradient overlay — bottom 55%
  const grad = ctx.createLinearGradient(0, H * 0.38, 0, H);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.4, 'rgba(0,0,0,0.6)');
  grad.addColorStop(1, 'rgba(0,0,0,0.88)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Title text — bold, white, wrapped
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 64px Arial`;
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 12;

  const lines = wrapText(ctx, title, MAX_TEXT_WIDTH);
  const lineHeight = 76;
  const totalTextHeight = lines.length * lineHeight;
  const textTop = H - PADDING - totalTextHeight;

  lines.forEach((line, i) => {
    ctx.fillText(line, PADDING, textTop + i * lineHeight);
  });

  ctx.shadowBlur = 0;

  // Accent bar — left edge, bottom section
  ctx.fillStyle = '#00aaff';
  ctx.fillRect(0, H * 0.38, 6, H * 0.62);

  // "NEW" badge — top right
  ctx.fillStyle = 'rgba(220,40,40,0.92)';
  drawRoundRect(ctx, W - 100, 20, 80, 36, 6);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px Arial';
  ctx.fillText('NEW', W - 86, 44);

  fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));
  log.success(`  Thumbnail (YouTube): ${outputPath}`);
  return outputPath;
}

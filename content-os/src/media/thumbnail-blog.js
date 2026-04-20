import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { log } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Noto Sans JP from @fontsource — Japanese subset woff2
const JP_FONT_PATH = path.resolve(
  __dirname,
  '../../node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff2'
);

const W = 1200;
const H = 630;

function el(type, style, children) {
  return { type, props: { style: { display: 'flex', ...style }, children } };
}

export async function generateBlogThumbnail(title, { tagline = '', date = '' } = {}, outputPath) {
  const fontData = fs.readFileSync(JP_FONT_PATH);
  const displayDate = date || new Date().toISOString().slice(0, 10);

  // Satori element tree — flexbox layout
  const tree = el(
    'div',
    {
      width: `${W}px`,
      height: `${H}px`,
      backgroundColor: '#0f0f1a',
      flexDirection: 'row',
    },
    [
      // Left accent bar
      el('div', {
        width: '8px',
        height: '100%',
        backgroundColor: '#00aaff',
        flexShrink: 0,
      }, []),

      // Main content
      el(
        'div',
        {
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '56px 64px',
        },
        [
          // Category tagline (optional)
          ...(tagline
            ? [
                el('div', {
                  fontSize: '22px',
                  color: '#00aaff',
                  marginBottom: '14px',
                  fontFamily: 'Noto Sans JP',
                  letterSpacing: '0.05em',
                }, tagline),
              ]
            : []),

          // Article title
          el('div', {
            fontSize: '50px',
            color: '#ffffff',
            lineHeight: 1.45,
            marginBottom: '36px',
            fontFamily: 'Noto Sans JP',
          }, title),

          // Divider
          el('div', {
            width: '48px',
            height: '3px',
            backgroundColor: '#444466',
            marginBottom: '20px',
          }, []),

          // Date
          el('div', {
            fontSize: '20px',
            color: '#666688',
            fontFamily: 'Noto Sans JP',
          }, displayDate),
        ]
      ),
    ]
  );

  const svg = await satori(tree, {
    width: W,
    height: H,
    fonts: [
      {
        name: 'Noto Sans JP',
        data: fontData,
        weight: 400,
        style: 'normal',
      },
    ],
  });

  const resvg = new Resvg(svg, { background: '#0f0f1a' });
  const rendered = resvg.render();
  const pngBuffer = rendered.asPng();

  fs.writeFileSync(outputPath, pngBuffer);
  log.success(`  Thumbnail (Blog OGP): ${outputPath}`);
  return outputPath;
}

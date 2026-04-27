import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { log } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Noto Sans JP from @fontsource — Japanese subset woff1 (woff2 is unsupported by opentype.js)
const JP_FONT_PATH = path.resolve(
  __dirname,
  '../../node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff'
);

const W = 1200;
const H = 630;

// カテゴリ別ビジュアル設定（アクセントカラー + 装飾漢字）
const CATEGORY_STYLES = {
  '技術':       { accent: '#00aaff', symbol: '技' },
  '規制・政策':  { accent: '#ff8844', symbol: '規' },
  '市場・投資':  { accent: '#00cc77', symbol: '市' },
  'ニュース':   { accent: '#ffcc00', symbol: '報' },
  'その他':    { accent: '#aa88ff', symbol: '考' },
};

function el(type, style, children) {
  return { type, props: { style: { display: 'flex', ...style }, children } };
}

export async function generateBlogThumbnail(title, { tagline = '', date = '', category = '' } = {}, outputPath) {
  const fontData = fs.readFileSync(JP_FONT_PATH);
  const displayDate = date || new Date().toISOString().slice(0, 10);
  const style = CATEGORY_STYLES[category] ?? CATEGORY_STYLES['その他'];
  const displayTagline = tagline || category || 'その他';

  // Satori element tree — flexbox layout
  const tree = el(
    'div',
    {
      width: `${W}px`,
      height: `${H}px`,
      backgroundColor: '#0f0f1a',
      flexDirection: 'row',
      overflow: 'hidden',
    },
    [
      // Left accent bar（カテゴリカラー）
      el('div', {
        width: '8px',
        height: '100%',
        backgroundColor: style.accent,
        flexShrink: 0,
      }, []),

      // Main content（装飾シンボル + テキスト）
      el(
        'div',
        {
          flex: 1,
          position: 'relative',
          flexDirection: 'column',
          overflow: 'hidden',
        },
        [
          // 装飾漢字（背景レイヤー、absolute）
          el('div', {
            position: 'absolute',
            right: '-10px',
            top: '-40px',
            fontSize: '320px',
            color: style.accent,
            opacity: 0.07,
            fontFamily: 'Noto Sans JP',
            lineHeight: '1',
            userSelect: 'none',
          }, style.symbol),

          // テキストコンテンツ（下揃え）
          el('div', {
            flex: 1,
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: '56px 64px',
          }, [
            // カテゴリラベル
            el('div', {
              fontSize: '22px',
              color: style.accent,
              marginBottom: '14px',
              fontFamily: 'Noto Sans JP',
              letterSpacing: '0.05em',
            }, displayTagline),

            // 記事タイトル
            el('div', {
              fontSize: '50px',
              color: '#ffffff',
              lineHeight: 1.45,
              marginBottom: '36px',
              fontFamily: 'Noto Sans JP',
              maxWidth: '900px',
            }, title),

            // 区切り線
            el('div', {
              width: '48px',
              height: '3px',
              backgroundColor: '#444466',
              marginBottom: '20px',
            }, []),

            // 日付
            el('div', {
              fontSize: '20px',
              color: '#666688',
              fontFamily: 'Noto Sans JP',
            }, displayDate),
          ]),
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

import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const prerender = false;

// Resend Inbound の email.received Webhook を受け、対象アドレス宛のメールを
// 指定先（Gmail）へそのまま転送する。
// セットアップ手順:
//   1. Resend ダッシュボードでドメインの Receiving を有効化し、MXレコードを追加
//   2. Webhooks で email.received イベントをこのエンドポイント
//      (https://cellbasedfood-lab.com/api/inbound-forward) に登録
//   3. 発行された Signing Secret を RESEND_INBOUND_WEBHOOK_SECRET に設定

const TIMESTAMP_TOLERANCE_SEC = 5 * 60;

interface ReceivedEventPayload {
  type: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string[];
    cc?: string[];
    subject?: string;
  };
}

// Svix 形式の署名検証（Resend Webhook は Svix 互換）
function verifySignature(secret: string, id: string, timestamp: string, rawBody: string, signatureHeader: string): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > TIMESTAMP_TOLERANCE_SEC) {
    return false;
  }
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest();
  return signatureHeader.split(' ').some(part => {
    const [version, sig] = part.split(',');
    if (version !== 'v1' || !sig) return false;
    const given = Buffer.from(sig, 'base64');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

function extractAddress(value: string): string {
  const match = value.match(/<([^>]+)>/);
  return (match ? match[1] : value).trim().toLowerCase();
}

export const POST: APIRoute = async ({ request }) => {
  const secret = import.meta.env.RESEND_INBOUND_WEBHOOK_SECRET;
  if (!secret) {
    console.error('RESEND_INBOUND_WEBHOOK_SECRET is not set');
    return json({ error: 'not configured' }, 500);
  }

  const rawBody = await request.text();
  const svixId = request.headers.get('svix-id') ?? '';
  const svixTimestamp = request.headers.get('svix-timestamp') ?? '';
  const svixSignature = request.headers.get('svix-signature') ?? '';

  if (!svixId || !svixTimestamp || !svixSignature ||
      !verifySignature(secret, svixId, svixTimestamp, rawBody, svixSignature)) {
    return json({ error: 'invalid signature' }, 401);
  }

  let event: ReceivedEventPayload;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: 'invalid payload' }, 400);
  }

  if (event.type !== 'email.received' || !event.data?.email_id) {
    return json({ ignored: true }, 200);
  }

  // 転送対象のアドレス（カンマ区切りで複数可）。宛先に含まれない受信は無視する
  const targets = (import.meta.env.INBOUND_FORWARD_ADDRESSES ?? 'info@cellbasedfood-lab.com')
    .split(',')
    .map((a: string) => a.trim().toLowerCase())
    .filter(Boolean);
  const recipients = [...(event.data.to ?? []), ...(event.data.cc ?? [])].map(extractAddress);
  if (!recipients.some(r => targets.includes(r))) {
    console.log(`Inbound email ${event.data.email_id} ignored (to: ${recipients.join(', ')})`);
    return json({ ignored: true }, 200);
  }

  const forwardTo = import.meta.env.INBOUND_FORWARD_TO ?? import.meta.env.CONTACT_NOTIFICATION_EMAIL;
  if (!forwardTo) {
    console.error('INBOUND_FORWARD_TO / CONTACT_NOTIFICATION_EMAIL is not set');
    return json({ error: 'not configured' }, 500);
  }
  const forwardFrom = import.meta.env.INBOUND_FORWARD_FROM
    ?? '細胞培養食品ラボ｜CellBasedFood Lab <info@cellbasedfood-lab.com>';

  const resend = new Resend(import.meta.env.RESEND_API_KEY);
  const { error } = await resend.emails.receiving.forward({
    emailId: event.data.email_id,
    to: forwardTo,
    from: forwardFrom,
    passthrough: true,
  });

  if (error) {
    console.error(`Inbound forward error (email_id: ${event.data.email_id}):`, error);
    // 500 を返すと Resend 側がリトライする
    return json({ error: (error as { message?: string })?.message ?? 'forward failed' }, 500);
  }

  console.log(`Forwarded inbound email ${event.data.email_id} (from: ${event.data.from}, subject: ${event.data.subject})`);
  return json({ success: true }, 200);
};

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

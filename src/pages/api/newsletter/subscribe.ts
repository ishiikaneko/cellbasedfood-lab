import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { createHmac } from 'crypto';
import { welcomeEmailHtml, welcomeEmailText } from '../../../lib/email/welcome';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Best-effort in-memory rate limiting (resets on cold start)
const recentRequests = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 3;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const times = (recentRequests.get(ip) ?? []).filter(t => now - t < WINDOW_MS);
  if (times.length >= MAX_PER_WINDOW) return true;
  times.push(now);
  recentRequests.set(ip, times);
  return false;
}

function unsubscribeToken(email: string): string {
  const secret = import.meta.env.UNSUBSCRIBE_SECRET ?? 'default-secret';
  return createHmac('sha256', secret).update(email.toLowerCase()).digest('hex');
}

export const POST: APIRoute = async ({ request }) => {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  if (isRateLimited(ip)) {
    return json({ error: 'リクエストが多すぎます。しばらくしてからお試しください。' }, 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: '不正なリクエストです。' }, 400);
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const consent = body.consent === true;

  if (!EMAIL_RE.test(email)) {
    return json({ error: '有効なメールアドレスを入力してください。' }, 400);
  }
  if (!consent) {
    return json({ error: 'プライバシーポリシーへの同意が必要です。' }, 400);
  }

  const resend = new Resend(import.meta.env.RESEND_API_KEY);
  const audienceId = import.meta.env.RESEND_AUDIENCE_ID;

  const { error: createErr } = await resend.contacts.create({ email, audienceId, unsubscribed: false });
  if (createErr) {
    const name = (createErr as { name?: string })?.name;
    // 'invalid_parameter' or similar when contact already exists — Resend returns error not 409
    const alreadyExists = /already.*exist|duplicate/i.test(String((createErr as { message?: string })?.message ?? ''));
    if (!alreadyExists) {
      console.error('Resend contacts.create error:', createErr);
      return json({ error: `登録に失敗しました: ${(createErr as { message?: string })?.message ?? name ?? 'unknown error'}` }, 500);
    }
  }

  const siteUrl = import.meta.env.SITE_URL ?? 'https://cellbasedfood-lab.com';
  const token = unsubscribeToken(email);
  const unsubUrl = `${siteUrl}/newsletter/unsubscribe?token=${token}&email=${encodeURIComponent(email)}`;
  const fromEmail = import.meta.env.RESEND_FROM_EMAIL ?? '細胞培養食品ラボ ｰCellBasedFood labｰ <newsletter@cellbasedfood-lab.com>';

  const { error: sendErr } = await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: '【細胞培養食品ラボ ｰCellBasedFood labｰ】メールマガジン登録を受け付けました',
    html: welcomeEmailHtml(unsubUrl),
    text: welcomeEmailText(unsubUrl),
  });
  if (sendErr) {
    console.error('Welcome email send error:', sendErr);
    return json({ error: `確認メール送信に失敗しました: ${(sendErr as { message?: string })?.message ?? 'unknown error'}` }, 500);
  }

  return json({ success: true }, 200);
};

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

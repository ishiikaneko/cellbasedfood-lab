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

  try {
    await resend.contacts.create({ email, audienceId, unsubscribed: false });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode;
    // 409 = already exists — treat as success
    if (status !== 409) {
      console.error('Resend contacts.create error:', err);
      return json({ error: '登録に失敗しました。しばらくしてからお試しください。' }, 500);
    }
  }

  const siteUrl = import.meta.env.SITE_URL ?? 'https://cellbasedfood-lab.com';
  const token = unsubscribeToken(email);
  const unsubUrl = `${siteUrl}/newsletter/unsubscribe?token=${token}&email=${encodeURIComponent(email)}`;
  const fromEmail = import.meta.env.RESEND_FROM_EMAIL ?? 'CellBasedFood Lab <newsletter@cellbasedfood-lab.com>';

  try {
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: '【CellBasedFood Lab】メールマガジン登録を受け付けました',
      html: welcomeEmailHtml(unsubUrl),
      text: welcomeEmailText(unsubUrl),
    });
  } catch (err) {
    console.error('Welcome email send error:', err);
  }

  return json({ success: true }, 200);
};

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

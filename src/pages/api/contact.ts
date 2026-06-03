import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { contactNotificationHtml, contactNotificationText } from '../../lib/email/contact-notification';
import { contactAutoreplyHtml, contactAutoreplyText } from '../../lib/email/contact-autoreply';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Best-effort in-memory rate limiting
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

  // Honeypot: if this field is filled, it's a bot — return 200 silently
  if (body.website) {
    return json({ success: true }, 200);
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 200) : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const consent = body.consent === true;

  if (!EMAIL_RE.test(email)) {
    return json({ error: '有効なメールアドレスを入力してください。' }, 400);
  }
  if (!subject) {
    return json({ error: '件名を入力してください。' }, 400);
  }
  if (message.length < 10) {
    return json({ error: '本文は10文字以上入力してください。' }, 400);
  }
  if (message.length > 2000) {
    return json({ error: '本文は2000文字以内で入力してください。' }, 400);
  }
  if (!consent) {
    return json({ error: 'プライバシーポリシーへの同意が必要です。' }, 400);
  }

  const resend = new Resend(import.meta.env.RESEND_API_KEY);
  const notifyEmail = import.meta.env.CONTACT_NOTIFICATION_EMAIL;
  const fromEmail = import.meta.env.RESEND_FROM_EMAIL ?? '細胞培養食品ラボ｜CellBasedFood Lab <newsletter@cellbasedfood-lab.com>';
  const sentAt = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

  const contactData = { name, email, subject, body: message, sentAt, ip };

  const { error: notifyErr } = await resend.emails.send({
    from: fromEmail,
    to: notifyEmail,
    replyTo: email,
    subject: `【細胞培養食品ラボ｜CellBasedFood Lab】お問い合わせがありました：${subject}`,
    html: contactNotificationHtml(contactData),
    text: contactNotificationText(contactData),
  });
  if (notifyErr) {
    console.error('Contact notification send error:', notifyErr);
    return json({ error: `メッセージ送信に失敗しました: ${(notifyErr as { message?: string })?.message ?? 'unknown error'}` }, 500);
  }

  const { error: autoErr } = await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: '【細胞培養食品ラボ｜CellBasedFood Lab】お問い合わせを受け付けました',
    html: contactAutoreplyHtml({ subject, body: message }),
    text: contactAutoreplyText({ subject, body: message }),
  });
  if (autoErr) {
    console.error('Contact autoreply send error:', autoErr);
  }

  return json({ success: true }, 200);
};

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

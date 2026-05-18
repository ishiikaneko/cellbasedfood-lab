import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { createHmac } from 'crypto';

export const prerender = false;

function verifyToken(email: string, token: string): boolean {
  const secret = import.meta.env.UNSUBSCRIBE_SECRET ?? 'default-secret';
  const expected = createHmac('sha256', secret).update(email.toLowerCase()).digest('hex');
  return token === expected;
}

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: '不正なリクエストです。' }, 400);
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const token = typeof body.token === 'string' ? body.token.trim() : '';

  if (!email || !token) {
    return json({ error: 'パラメータが不正です。' }, 400);
  }

  if (!verifyToken(email, token)) {
    return json({ error: 'リンクが無効です。' }, 400);
  }

  const resend = new Resend(import.meta.env.RESEND_API_KEY);
  const audienceId = import.meta.env.RESEND_AUDIENCE_ID;

  const { data: listData, error: listErr } = await resend.contacts.list({ audienceId });
  if (listErr) {
    console.error('Unsubscribe list error:', listErr);
    return json({ error: `配信停止に失敗しました: ${(listErr as { message?: string })?.message ?? 'unknown error'}` }, 500);
  }

  const contacts = (listData as { data?: Array<{ id: string; email: string }> })?.data ?? [];
  const contact = contacts.find(c => c.email.toLowerCase() === email.toLowerCase());

  if (contact) {
    const { error: updateErr } = await resend.contacts.update({
      id: contact.id,
      audienceId,
      unsubscribed: true,
    });
    if (updateErr) {
      console.error('Unsubscribe update error:', updateErr);
      return json({ error: `配信停止に失敗しました: ${(updateErr as { message?: string })?.message ?? 'unknown error'}` }, 500);
    }
  }
  // If contact not found, treat as already unsubscribed

  return json({ success: true }, 200);
};

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

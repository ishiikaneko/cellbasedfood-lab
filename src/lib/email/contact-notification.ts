interface ContactData {
  name: string;
  email: string;
  subject: string;
  body: string;
  sentAt: string;
  ip: string;
}

export function contactNotificationHtml(data: ContactData): string {
  const escapedBody = data.body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#fafaf8;font-family:'Noto Sans JP',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px">
    <div style="font-family:'Space Mono',monospace;font-size:13px;font-weight:700;color:#0F6E56;margin-bottom:28px;letter-spacing:.04em">
      細胞培養食品ラボ｜CellBasedFood Lab — お問い合わせ通知
    </div>
    <p style="font-size:15px;color:#333;line-height:1.8;margin:0 0 20px">
      お問い合わせを受信しました。
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px">
      <tr>
        <td style="padding:10px 12px;background:#f5f4f0;border:0.5px solid #e5e4df;white-space:nowrap;color:#555;width:120px">お名前</td>
        <td style="padding:10px 12px;border:0.5px solid #e5e4df;color:#1a1a18">${data.name || '（未記入）'}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;background:#f5f4f0;border:0.5px solid #e5e4df;white-space:nowrap;color:#555">メールアドレス</td>
        <td style="padding:10px 12px;border:0.5px solid #e5e4df;color:#1a1a18">
          <a href="mailto:${data.email}" style="color:#0F6E56">${data.email}</a>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 12px;background:#f5f4f0;border:0.5px solid #e5e4df;white-space:nowrap;color:#555">件名</td>
        <td style="padding:10px 12px;border:0.5px solid #e5e4df;color:#1a1a18">${data.subject}</td>
      </tr>
    </table>
    <div style="margin-bottom:20px">
      <div style="font-size:13px;color:#888;margin-bottom:8px;font-family:'Space Mono',monospace;letter-spacing:.06em">本文</div>
      <div style="padding:16px;background:#f5f4f0;border:0.5px solid #e5e4df;border-radius:6px;font-size:14px;line-height:1.8;color:#1a1a18">
        ${escapedBody}
      </div>
    </div>
    <hr style="margin:24px 0;border:none;border-top:0.5px solid #e5e4df">
    <p style="font-size:12px;color:#aaa;line-height:1.6;margin:0">
      送信日時：${data.sentAt}<br>
      IPアドレス：${data.ip}
    </p>
  </div>
</body>
</html>`;
}

export function contactNotificationText(data: ContactData): string {
  return `お問い合わせを受信しました。

お名前：${data.name || '（未記入）'}
メールアドレス：${data.email}
件名：${data.subject}

---本文---
${data.body}
---

送信日時：${data.sentAt}
IPアドレス：${data.ip}`;
}

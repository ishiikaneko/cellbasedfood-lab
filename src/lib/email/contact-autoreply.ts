interface ContactData {
  subject: string;
  body: string;
}

export function contactAutoreplyHtml(data: ContactData): string {
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
      細胞培養食品ラボ｜CellBasedFood Lab
    </div>
    <h1 style="font-size:18px;font-weight:600;color:#1a1a18;margin:0 0 20px;line-height:1.6">
      お問い合わせを受け付けました
    </h1>
    <p style="font-size:15px;color:#333;line-height:1.8;margin:0 0 20px">
      お問い合わせいただきありがとうございます。<br>
      以下の内容で受け付けました。返信までしばらくお待ちください。
    </p>
    <div style="margin-bottom:28px">
      <div style="font-size:13px;color:#888;margin-bottom:8px;font-family:'Space Mono',monospace;letter-spacing:.06em">お問い合わせ内容</div>
      <div style="padding:16px;background:#f5f4f0;border:0.5px solid #e5e4df;border-radius:6px;font-size:14px;line-height:1.8;color:#1a1a18">
        <strong>件名：${data.subject}</strong><br><br>
        ${escapedBody}
      </div>
    </div>
    <p style="font-size:13px;color:#888;line-height:1.7;margin:0 0 28px">
      このメールは自動送信です。<br>
      返信が必要な場合は、改めて運営者よりご連絡いたします。
    </p>
    <hr style="margin:28px 0;border:none;border-top:0.5px solid #e5e4df">
    <p style="font-size:13px;color:#888;line-height:1.7;margin:0">
      細胞培養食品ラボ｜CellBasedFood Lab<br>
      <a href="https://cellbasedfood-lab.com/" style="color:#0F6E56;text-decoration:none">https://cellbasedfood-lab.com/</a>
    </p>
  </div>
</body>
</html>`;
}

export function contactAutoreplyText(data: ContactData): string {
  return `お問い合わせいただきありがとうございます。
以下の内容で受け付けました。返信までしばらくお待ちください。

---お問い合わせ内容---
件名：${data.subject}
${data.body}
---

このメールは自動送信です。
返信が必要な場合は、改めて運営者よりご連絡いたします。

---
細胞培養食品ラボ｜CellBasedFood Lab
https://cellbasedfood-lab.com/`;
}

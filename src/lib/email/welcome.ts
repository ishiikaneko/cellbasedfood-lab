export function welcomeEmailHtml(unsubscribeUrl: string): string {
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
      メールマガジン登録を受け付けました
    </h1>
    <p style="font-size:15px;color:#333;line-height:1.8;margin:0 0 14px">
      この度は細胞培養食品ラボ｜CellBasedFood Labメールマガジンへのご登録ありがとうございます。
    </p>
    <p style="font-size:15px;color:#333;line-height:1.8;margin:0 0 14px">
      ご登録のメールアドレスを受け付けました。<br>
      月1回程度、新着記事のまとめと書籍情報をお届けする予定です。
    </p>
    <p style="font-size:15px;color:#333;line-height:1.8;margin:0 0 14px">
      登録特典として、本メールに<strong>「国内培養肉業界リスト（2026年7月版）」</strong>（Excelファイル）を添付しております。ぜひご活用ください。
    </p>
    <p style="font-size:15px;color:#333;line-height:1.8;margin:0 0 28px">
      なお、登録した覚えがない場合や配信を停止したい場合は、<br>
      以下のリンクから手続きをお願いします。
    </p>
    <a href="${unsubscribeUrl}"
      style="display:inline-block;padding:10px 22px;background:#f5f4f0;border:0.5px solid #dddbd4;border-radius:6px;font-size:14px;color:#555;text-decoration:none">
      配信停止はこちら
    </a>
    <hr style="margin:36px 0;border:none;border-top:0.5px solid #e5e4df">
    <p style="font-size:12px;color:#888;line-height:1.9;margin:0">
      <strong style="color:#666">細胞培養食品ラボ｜CellBasedFood Lab</strong><br>
      〒103-0027 東京都中央区日本橋2丁目16-4 remix日本橋 6階<br>
      お問い合わせ：<a href="https://cellbasedfood-lab.com/contact" style="color:#0F6E56;text-decoration:none">https://cellbasedfood-lab.com/contact</a><br>
      配信停止：<a href="${unsubscribeUrl}" style="color:#0F6E56;text-decoration:none">こちらのリンク</a>からいつでも手続きいただけます。<br>
      <a href="https://cellbasedfood-lab.com/" style="color:#0F6E56;text-decoration:none">https://cellbasedfood-lab.com/</a>
    </p>
  </div>
</body>
</html>`;
}

export function welcomeEmailText(unsubscribeUrl: string): string {
  return `この度は細胞培養食品ラボ｜CellBasedFood Labメールマガジンへのご登録ありがとうございます。

ご登録のメールアドレスを受け付けました。
月1回程度、新着記事のまとめと書籍情報をお届けする予定です。

登録特典として、本メールに「国内培養肉業界リスト（2026年7月版）」（Excelファイル）を添付しております。ぜひご活用ください。

なお、登録した覚えがない場合や配信を停止したい場合は、
以下のリンクから手続きをお願いします。
${unsubscribeUrl}

-----------------------------------------
細胞培養食品ラボ｜CellBasedFood Lab
〒103-0027 東京都中央区日本橋2丁目16-4 remix日本橋 6階
お問い合わせ：https://cellbasedfood-lab.com/contact
配信停止：上記リンクからいつでも手続きいただけます。
https://cellbasedfood-lab.com/`;
}

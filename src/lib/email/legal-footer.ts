// メール共通の法令対応フッター（特定電子メール法の表示義務）。
//
// 送信者名・住所・問い合わせ先・配信停止をまとめて表示する。
// 広告・宣伝を含むメール（メルマガ本文・登録確認メール等）を新しく送る際は、
// **必ずこのフッターを本文末尾に入れること**。値を変えるときはここだけ直せば全メールに反映される。
//
// 注意：Resend ダッシュボード（Broadcasts）から手動送信する月次メルマガは、
// このコードを経由しないため footer が自動では入らない。
// docs/newsletter-compliance.md の貼り付け用フッターを使うこと。

export const SENDER = {
  name: '細胞培養食品ラボ｜CellBasedFood Lab',
  postalCode: '〒103-0027',
  address: '東京都中央区日本橋2丁目16-4 remix日本橋 6階',
  contactUrl: 'https://cellbasedfood-lab.com/contact',
  siteUrl: 'https://cellbasedfood-lab.com/',
} as const;

/** HTML メール用の法令フッター。unsubscribeUrl は受信者ごとの配信停止URL。 */
export function legalFooterHtml(unsubscribeUrl: string): string {
  return `<hr style="margin:36px 0;border:none;border-top:0.5px solid #e5e4df">
    <p style="font-size:12px;color:#888;line-height:1.9;margin:0">
      <strong style="color:#666">${SENDER.name}</strong><br>
      ${SENDER.postalCode} ${SENDER.address}<br>
      お問い合わせ：<a href="${SENDER.contactUrl}" style="color:#0F6E56;text-decoration:none">${SENDER.contactUrl}</a><br>
      配信停止：<a href="${unsubscribeUrl}" style="color:#0F6E56;text-decoration:none">こちらのリンク</a>からいつでも手続きいただけます。<br>
      <a href="${SENDER.siteUrl}" style="color:#0F6E56;text-decoration:none">${SENDER.siteUrl}</a>
    </p>`;
}

/** テキストメール用の法令フッター。 */
export function legalFooterText(unsubscribeUrl: string): string {
  return `-----------------------------------------
${SENDER.name}
${SENDER.postalCode} ${SENDER.address}
お問い合わせ：${SENDER.contactUrl}
配信停止：${unsubscribeUrl}
${SENDER.siteUrl}`;
}

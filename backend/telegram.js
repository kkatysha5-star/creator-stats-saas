const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = '5306380278';

// Счётчики последовательных ошибок по платформам
const platformErrorCounts = {};
const ERROR_THRESHOLD = 5;

export async function sendAlert(message) {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: 'HTML' }),
    });
  } catch (err) {
    console.error('[telegram] Failed to send alert:', err.message);
  }
}

export function trackPlatformError(platform, videoId, errorMsg) {
  platformErrorCounts[platform] = (platformErrorCounts[platform] || 0) + 1;
  const count = platformErrorCounts[platform];
  if (count >= ERROR_THRESHOLD) {
    sendAlert(
      `🔴 <b>Массовые ошибки парсинга</b>\n` +
      `Платформа: <b>${platform}</b>\n` +
      `Ошибок подряд: ${count}\n` +
      `Последняя: ${errorMsg}`
    );
    platformErrorCounts[platform] = 0;
  }
}

export function clearPlatformErrors(platform) {
  platformErrorCounts[platform] = 0;
}

export function trackSuspiciousActivity(ip, type, path) {
  const msg = `⚠️ <b>Подозрительная активность</b>\nIP: <code>${ip}</code>\nТип: ${type}\nПуть: ${path}`;
  sendAlert(msg);
}

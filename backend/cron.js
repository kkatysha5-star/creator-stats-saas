import cron from 'node-cron';
import { db } from './db.js';
import { fetchStatsForVideo } from './fetchers.js';

// Умное обновление: частота зависит от возраста видео
// - младше 7 дней  → каждые 12 часов
// - 7–30 дней      → раз в день
// - старше 30 дней → раз в неделю

function getAgeInDays(publishedAt, addedAt) {
  const date = publishedAt || addedAt;
  if (!date) return 999;
  const ms = Date.now() - new Date(date).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

function shouldRefresh(video, nowHour) {
  const age = getAgeInDays(video.published_at, video.added_at);

  if (age < 7) {
    // Каждые 12 часов — запускаем в 0:00 и 12:00
    return nowHour === 0 || nowHour === 12;
  }

  if (age < 30) {
    // Раз в день — запускаем в 6:00
    return nowHour === 6;
  }

  // Раз в неделю — запускаем в воскресенье в 4:00
  const dayOfWeek = new Date().getDay(); // 0 = воскресенье
  return dayOfWeek === 0 && nowHour === 4;
}

export function setupCron() {
  // Запускаем каждый час — внутри решаем какие видео обновлять
  cron.schedule('0 * * * *', async () => {
    const nowHour = new Date().getUTCHours();
    console.log(`[cron] Tick at UTC hour ${nowHour}`);
    await refreshSmartStats(nowHour);
  });

  console.log('[cron] Scheduled: smart stats refresh (hourly tick)');
}

export async function refreshSmartStats(nowHour = new Date().getUTCHours()) {
  const result = await db.execute('SELECT * FROM videos');
  const videos = result.rows;

  const toRefresh = videos.filter(v => shouldRefresh(v, nowHour));

  if (toRefresh.length === 0) {
    console.log('[cron] No videos to refresh this hour');
    return { updated: 0, failed: 0, skipped: videos.length };
  }

  console.log(`[cron] Refreshing ${toRefresh.length} of ${videos.length} videos...`);
  let updated = 0, failed = 0;

  for (const video of toRefresh) {
    try {
      const stats = await fetchStatsForVideo(video);
      const lastResult = await db.execute({
        sql: 'SELECT * FROM stats_snapshots WHERE video_id = ? ORDER BY fetched_at DESC LIMIT 1',
        args: [video.id],
      });
      const last = lastResult.rows[0];
      const hasChanged = !last || last.views !== stats.views || last.likes !== stats.likes;

      if (hasChanged) {
        const er = stats.views > 0
          ? ((stats.likes + stats.comments + (stats.saves || 0)) / stats.views * 100)
          : 0;
        await db.execute({
          sql: 'INSERT INTO stats_snapshots (video_id, views, likes, comments, saves, shares, er) VALUES (?, ?, ?, ?, ?, ?, ?)',
          args: [video.id, stats.views, stats.likes, stats.comments, stats.saves, stats.shares, er],
        });
        if (!video.title && stats.title) {
          await db.execute({
            sql: 'UPDATE videos SET title = ?, published_at = ? WHERE id = ?',
            args: [stats.title, stats.published_at, video.id],
          });
        }
        updated++;
      }
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.error(`[cron] Failed for video ${video.id}:`, err.message);
      failed++;
    }
  }

  console.log(`[cron] Done: ${updated} updated, ${failed} failed, ${videos.length - toRefresh.length} skipped`);
  return { updated, failed, skipped: videos.length - toRefresh.length };
}

// Оставляем для ручного вызова через /api/stats/refresh-all
export async function refreshAllStats() {
  return refreshSmartStats(0); // передаём 0 — обновит все видео младше 7 дней
}

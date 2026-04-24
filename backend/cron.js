import cron from 'node-cron';
import { db } from './db.js';
import { fetchStatsForVideo } from './fetchers.js';
import { isPlanActive } from './middleware/auth.js';
import { trackPlatformError, clearPlatformErrors } from './telegram.js';

function getAgeInDays(publishedAt, addedAt) {
  const date = publishedAt || addedAt;
  if (!date) return 999;
  const ms = Date.now() - new Date(date).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

function shouldRefresh(video, nowHour) {
  const age = getAgeInDays(video.published_at, video.added_at);

  if (age < 7) {
    return nowHour === 0 || nowHour === 12;
  }

  if (age < 30) {
    return nowHour === 6;
  }

  const dayOfWeek = new Date().getDay();
  return dayOfWeek === 0 && nowHour === 4;
}

// Кеш статусов воркспейсов чтобы не дёргать БД на каждое видео
async function getActiveWorkspaceIds() {
  const result = await db.execute('SELECT id, plan, trial_ends_at FROM workspaces');
  const active = new Set();
  for (const ws of result.rows) {
    if (isPlanActive(ws)) active.add(Number(ws.id));
  }
  return active;
}

export function setupCron() {
  cron.schedule('0 * * * *', async () => {
    const nowHour = new Date().getUTCHours();
    console.log(`[cron] Tick at UTC hour ${nowHour}`);
    await refreshSmartStats(nowHour);
  });

  console.log('[cron] Scheduled: smart stats refresh (hourly tick)');
}

export async function refreshSmartStats(nowHour = new Date().getUTCHours()) {
  const activeWsIds = await getActiveWorkspaceIds();

  const result = await db.execute('SELECT * FROM videos');
  const videos = result.rows;

  const toRefresh = videos.filter(v => {
    // Пропускаем видео из воркспейсов с истёкшим планом
    if (v.workspace_id && !activeWsIds.has(Number(v.workspace_id))) return false;
    return shouldRefresh(v, nowHour);
  });

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
      // Очищаем ошибку при успехе
      await db.execute({ sql: 'UPDATE videos SET last_error = NULL WHERE id = ?', args: [video.id] });
      clearPlatformErrors(video.platform);
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.error(`[cron] Failed for video ${video.id}:`, err.message);
      // Сохраняем ошибку в БД
      try {
        await db.execute({
          sql: 'UPDATE videos SET last_error = ? WHERE id = ?',
          args: [err.message, video.id]
        });
      } catch {}
      trackPlatformError(video.platform, video.id, err.message);
      failed++;
    }
  }

  console.log(`[cron] Done: ${updated} updated, ${failed} failed, ${videos.length - toRefresh.length} skipped`);
  return { updated, failed, skipped: videos.length - toRefresh.length };
}

export async function refreshAllStats() {
  const activeWsIds = await getActiveWorkspaceIds();
  const result = await db.execute('SELECT * FROM videos');
  const videos = result.rows.filter(v => !v.workspace_id || activeWsIds.has(Number(v.workspace_id)));

  console.log(`[cron] Manual refresh: ${videos.length} videos...`);
  let updated = 0, failed = 0;

  for (const video of videos) {
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
      await db.execute({ sql: 'UPDATE videos SET last_error = NULL WHERE id = ?', args: [video.id] });
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.error(`[cron] Failed for video ${video.id}:`, err.message);
      try {
        await db.execute({
          sql: 'UPDATE videos SET last_error = ? WHERE id = ?',
          args: [err.message, video.id]
        });
      } catch {}
      failed++;
    }
  }

  console.log(`[cron] Manual refresh done: ${updated} updated, ${failed} failed`);
  return { updated, failed };
}

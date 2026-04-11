import cron from 'node-cron';
import { db } from './db.js';
import { fetchStatsForVideo } from './fetchers.js';

export function setupCron() {
  cron.schedule('0 */6 * * *', async () => {
    console.log('[cron] Starting stats refresh...');
    await refreshAllStats();
  });
  console.log('[cron] Scheduled: stats refresh every 6 hours');
}

export async function refreshAllStats() {
  const result = await db.execute('SELECT * FROM videos');
  const videos = result.rows;
  let updated = 0, failed = 0;

  for (const video of videos) {
    try {
      const stats = await fetchStatsForVideo(video);
      const lastResult = await db.execute({ sql: 'SELECT * FROM stats_snapshots WHERE video_id = ? ORDER BY fetched_at DESC LIMIT 1', args: [video.id] });
      const last = lastResult.rows[0];
      const hasChanged = !last || last.views !== stats.views || last.likes !== stats.likes;

      if (hasChanged) {
        const er = stats.views > 0 ? ((stats.likes + stats.comments + (stats.saves || 0)) / stats.views * 100) : 0;
        await db.execute({ sql: 'INSERT INTO stats_snapshots (video_id, views, likes, comments, saves, shares, er) VALUES (?, ?, ?, ?, ?, ?, ?)', args: [video.id, stats.views, stats.likes, stats.comments, stats.saves, stats.shares, er] });
        if (!video.title && stats.title) {
          await db.execute({ sql: 'UPDATE videos SET title = ?, published_at = ? WHERE id = ?', args: [stats.title, stats.published_at, video.id] });
        }
        updated++;
      }
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.error(`[cron] Failed for video ${video.id}:`, err.message);
      failed++;
    }
  }
  console.log(`[cron] Done: ${updated} updated, ${failed} failed`);
  return { updated, failed };
}

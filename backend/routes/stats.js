import { Router } from 'express';
import { db } from '../db.js';
import { fetchStatsForVideo } from '../fetchers.js';
import { requireAuth, requireActivePlan } from '../middleware/auth.js';

const router = Router();

const refreshCooldowns = new Map();
const COOLDOWN_MS = 12 * 60 * 60 * 1000;

router.get('/summary', async (req, res) => {
  try {
    const { from, to, platform, creator_id } = req.query;
    const wsId = req.workspaceId || req.query.workspace_id;
    let filter = 'WHERE 1=1';
    const args = [];
    if (wsId) { filter += ' AND v.workspace_id = ?'; args.push(wsId); }
    if (creator_id) { filter += ' AND v.creator_id = ?'; args.push(creator_id); }
    if (platform) { filter += ' AND v.platform = ?'; args.push(platform); }
    if (from) { filter += ' AND v.published_at >= ?'; args.push(from); }
    if (to) { filter += ' AND v.published_at <= ?'; args.push(to); }

    const result = await db.execute({ sql: `
      SELECT
        COUNT(DISTINCT COALESCE(v.post_id, v.id)) as total_videos,
        SUM(COALESCE(s.views, 0)) as total_views,
        SUM(COALESCE(s.likes, 0)) as total_likes,
        SUM(COALESCE(s.comments, 0)) as total_comments,
        SUM(COALESCE(s.saves, 0)) as total_saves,
        SUM(COALESCE(s.shares, 0)) as total_shares,
        AVG(CASE WHEN s.views > 0 THEN s.er END) as avg_er
      FROM videos v
      JOIN creators c ON v.creator_id = c.id
      LEFT JOIN (
        SELECT video_id, views, likes, comments, saves, shares, er,
               ROW_NUMBER() OVER (PARTITION BY video_id ORDER BY fetched_at DESC) as rn
        FROM stats_snapshots
      ) s ON s.video_id = v.id AND s.rn = 1
      ${filter}
    `, args });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/by-creator', async (req, res) => {
  try {
    const { from, to, platform } = req.query;
    const wsId = req.workspaceId || req.query.workspace_id;
    let filter = 'WHERE 1=1';
    const args = [];
    if (wsId) { filter += ' AND (v.workspace_id = ? OR v.workspace_id IS NULL)'; args.push(wsId); }
    if (platform) { filter += ' AND v.platform = ?'; args.push(platform); }
    if (from) { filter += ' AND v.published_at >= ?'; args.push(from); }
    if (to) { filter += ' AND v.published_at <= ?'; args.push(to); }

    const result = await db.execute({ sql: `
      SELECT
        c.id as creator_id, c.name as creator_name, c.avatar_color,
        c.video_plan_count, c.video_plan_period, c.reach_plan, c.daily_rate,
        COALESCE(
          (SELECT fp.date_from FROM funnel_periods fp WHERE fp.creator_id = c.id AND fp.is_active = 1 ORDER BY fp.date_from DESC LIMIT 1),
          c.period_start
        ) as period_start,
        COUNT(DISTINCT COALESCE(v.post_id, v.id)) as total_videos,
        GROUP_CONCAT(DISTINCT v.platform) as platforms,
        SUM(COALESCE(s.views, 0)) as total_views,
        SUM(COALESCE(s.likes, 0)) as total_likes,
        SUM(COALESCE(s.comments, 0)) as total_comments,
        SUM(COALESCE(s.saves, 0)) as total_saves,
        SUM(COALESCE(s.shares, 0)) as total_shares,
        AVG(CASE WHEN s.views > 0 THEN s.er END) as avg_er
      FROM creators c
      LEFT JOIN videos v ON v.creator_id = c.id
      LEFT JOIN (
        SELECT video_id, views, likes, comments, saves, shares, er,
               ROW_NUMBER() OVER (PARTITION BY video_id ORDER BY fetched_at DESC) as rn
        FROM stats_snapshots
      ) s ON s.video_id = v.id AND s.rn = 1
      ${filter}
      GROUP BY c.id, c.name, c.avatar_color
      ORDER BY total_views DESC
    `, args });
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Обновить одно видео — с кулдауном 12 часов
router.post('/refresh-video/:id', requireAuth, requireActivePlan, async (req, res) => {
  try {
    const videoId = parseInt(req.params.id);

    // Проверяем кулдаун
    const lastRefresh = refreshCooldowns.get(videoId);
    if (lastRefresh && (Date.now() - lastRefresh) < COOLDOWN_MS) {
      const minutesLeft = Math.ceil((COOLDOWN_MS - (Date.now() - lastRefresh)) / 60000);
      const hoursLeft = minutesLeft >= 60 ? Math.ceil(minutesLeft / 60) : null;
      const timeMsg = hoursLeft ? `${hoursLeft} ч.` : `${minutesLeft} мин.`;
      return res.status(429).json({
        error: `Обновить можно раз в 12 часов. Следующее обновление через ${timeMsg}.`
      });
    }

    const result = await db.execute({ sql: 'SELECT * FROM videos WHERE id = ?', args: [videoId] });
    const video = result.rows[0];
    if (!video) return res.status(404).json({ error: 'Видео не найдено' });

    // Проверяем что видео принадлежит воркспейсу пользователя
    const wsId = req.workspaceId;
    if (wsId && video.workspace_id && Number(video.workspace_id) !== wsId) {
      return res.status(403).json({ error: 'Нет доступа к этому видео' });
    }

    const stats = await fetchStatsForVideo(video);
    const er = stats.views > 0
      ? ((stats.likes + stats.comments + (stats.saves || 0)) / stats.views * 100)
      : 0;

    await db.execute({
      sql: 'INSERT INTO stats_snapshots (video_id, views, likes, comments, saves, shares, er) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [videoId, stats.views, stats.likes, stats.comments, stats.saves, stats.shares, er],
    });

    // Очищаем ошибку при успехе
    await db.execute({ sql: 'UPDATE videos SET last_error = NULL WHERE id = ?', args: [videoId] });

    if (stats.title) {
      await db.execute({
        sql: 'UPDATE videos SET title = ?, published_at = COALESCE(published_at, ?) WHERE id = ?',
        args: [stats.title, stats.published_at, videoId],
      });
    }

    refreshCooldowns.set(videoId, Date.now());

    res.json({ ok: true, stats });
  } catch (e) {
    // Сохраняем ошибку в БД
    try {
      await db.execute({
        sql: 'UPDATE videos SET last_error = ? WHERE id = ?',
        args: [e.message, parseInt(req.params.id)]
      });
    } catch {}
    res.status(500).json({ error: e.message });
  }
});

export default router;

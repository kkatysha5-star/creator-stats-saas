import { Router } from 'express';
import { db } from '../db.js';
import { detectPlatform, extractVideoId, fetchStatsForVideo } from '../fetchers.js';
import { requireAuth, requireActivePlan } from '../middleware/auth.js';
import { invalidateVideoCache } from '../cron.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { creator_id, platform, from, to } = req.query;
    const wsId = req.workspaceId || req.query.workspace_id;
    let filter = 'WHERE 1=1';
    const args = [];
    if (wsId) { filter += ' AND v.workspace_id = ?'; args.push(wsId); }
    if (creator_id) { filter += ' AND v.creator_id = ?'; args.push(creator_id); }
    if (platform) { filter += ' AND v.platform = ?'; args.push(platform); }
    if (from) { filter += ' AND v.published_at >= ?'; args.push(from); }
    if (to) { filter += ' AND v.published_at <= ?'; args.push(to); }

    const result = await db.execute({ sql: `
      SELECT v.*, c.name as creator_name, c.avatar_color,
        s.views, s.likes, s.comments, s.saves, s.shares, s.er, s.fetched_at as stats_updated_at
      FROM videos v
      JOIN creators c ON v.creator_id = c.id
      LEFT JOIN (
        SELECT video_id, views, likes, comments, saves, shares, er, fetched_at,
               ROW_NUMBER() OVER (PARTITION BY video_id ORDER BY fetched_at DESC) as rn
        FROM stats_snapshots
      ) s ON s.video_id = v.id AND s.rn = 1
      ${filter}
      ORDER BY v.published_at DESC, v.added_at DESC
    `, args });
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, requireActivePlan, async (req, res) => {
  try {
    const { url, creator_id, platform: forcedPlatform, title, published_at } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });
    if (!creator_id) return res.status(400).json({ error: 'creator_id is required' });

    const platform = forcedPlatform || detectPlatform(url);
    if (!platform) return res.status(400).json({ error: 'Cannot detect platform' });
    const video_id = extractVideoId(url, platform);

    const wsId = req.workspaceId || req.body.workspace_id;
    const result = await db.execute({
      sql: 'INSERT INTO videos (creator_id, platform, url, video_id, title, published_at, workspace_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [creator_id, platform, url, video_id || null, title || null, published_at || null, wsId || 1]
    });
    const videoDbId = result.lastInsertRowid;

    const videoRow = await db.execute({ sql: 'SELECT * FROM videos WHERE id = ?', args: [videoDbId] });
    const video = videoRow.rows[0];
    try {
      const stats = await fetchStatsForVideo(video);
      const er = stats.views > 0 ? ((stats.likes + stats.comments + (stats.saves || 0)) / stats.views * 100) : 0;
      await db.execute({
        sql: 'INSERT INTO stats_snapshots (video_id, views, likes, comments, saves, shares, er) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [videoDbId, stats.views, stats.likes, stats.comments, stats.saves, stats.shares, er]
      });
      if (stats.title) {
        await db.execute({
          sql: 'UPDATE videos SET title = COALESCE(title, ?), published_at = COALESCE(published_at, ?), last_error = NULL WHERE id = ?',
          args: [stats.title, stats.published_at, videoDbId]
        });
      }
    } catch (err) {
      console.warn('Stats fetch failed:', err.message);
      await db.execute({
        sql: 'UPDATE videos SET last_error = ? WHERE id = ?',
        args: [err.message, videoDbId]
      });
    }

    invalidateVideoCache();
    const final = await db.execute({
      sql: `SELECT v.*, c.name as creator_name, c.avatar_color,
              s.views, s.likes, s.comments, s.saves, s.shares, s.er
            FROM videos v
            JOIN creators c ON v.creator_id = c.id
            LEFT JOIN (
              SELECT video_id, views, likes, comments, saves, shares, er
              FROM stats_snapshots WHERE video_id = ? ORDER BY fetched_at DESC LIMIT 1
            ) s ON s.video_id = v.id
            WHERE v.id = ?`,
      args: [videoDbId, videoDbId]
    });
    res.status(201).json(final.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/refresh', requireAuth, requireActivePlan, async (req, res) => {
  try {
    const videoRow = await db.execute({ sql: 'SELECT * FROM videos WHERE id = ?', args: [req.params.id] });
    if (!videoRow.rows.length) return res.status(404).json({ error: 'Not found' });
    const video = videoRow.rows[0];

    // Проверяем принадлежность воркспейсу
    const wsId = req.workspaceId;
    if (wsId && video.workspace_id && Number(video.workspace_id) !== wsId) {
      return res.status(403).json({ error: 'Нет доступа к этому видео' });
    }

    const stats = await fetchStatsForVideo(video);
    const er = stats.views > 0 ? ((stats.likes + stats.comments + (stats.saves || 0)) / stats.views * 100) : 0;
    await db.execute({
      sql: 'INSERT INTO stats_snapshots (video_id, views, likes, comments, saves, shares, er) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [video.id, stats.views, stats.likes, stats.comments, stats.saves, stats.shares, er]
    });
    await db.execute({ sql: 'UPDATE videos SET last_error = NULL WHERE id = ?', args: [video.id] });
    res.json({ ok: true, stats });
  } catch (e) {
    try {
      await db.execute({ sql: 'UPDATE videos SET last_error = ? WHERE id = ?', args: [e.message, req.params.id] });
    } catch {}
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', requireAuth, requireActivePlan, async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM videos WHERE id = ?', args: [req.params.id] });
    invalidateVideoCache();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;

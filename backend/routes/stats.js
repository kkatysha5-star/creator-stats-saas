import { Router } from 'express';
import { db } from '../db.js';
import { refreshAllStats } from '../cron.js';

const router = Router();

router.get('/summary', async (req, res) => {
  try {
    const { from, to, platform, creator_id } = req.query;
    let filter = 'WHERE 1=1';
    const args = [];
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
    let filter = 'WHERE 1=1';
    const args = [];
    if (platform) { filter += ' AND v.platform = ?'; args.push(platform); }
    if (from) { filter += ' AND v.published_at >= ?'; args.push(from); }
    if (to) { filter += ' AND v.published_at <= ?'; args.push(to); }

    const result = await db.execute({ sql: `
      SELECT
        c.id as creator_id, c.name as creator_name, c.avatar_color,
        c.video_plan_count, c.video_plan_period, c.reach_plan,
        (SELECT fp.date_from FROM funnel_periods fp WHERE fp.creator_id = c.id AND fp.is_active = 1 ORDER BY fp.date_from DESC LIMIT 1) as period_start,
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

router.post('/refresh-all', async (req, res) => {
  try {
    const result = await refreshAllStats();
    res.json({ ok: true, ...result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;

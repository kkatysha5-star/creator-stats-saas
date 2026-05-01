import { Router } from 'express';
import { db } from '../db.js';
import { fetchStatsForVideo } from '../fetchers.js';
import { requireAuth, requireActivePlan } from '../middleware/auth.js';

const router = Router();

const COOLDOWN_MS = 12 * 60 * 60 * 1000;
const inProgress = globalThis.__videoRefreshInProgress || new Map();
globalThis.__videoRefreshInProgress = inProgress;

function parseFetchedAt(value) {
  if (!value) return null;
  const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T') + 'Z';
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatCooldown(ms) {
  const minutesLeft = Math.ceil(ms / 60000);
  const hoursLeft = minutesLeft >= 60 ? Math.ceil(minutesLeft / 60) : null;
  return hoursLeft ? `${hoursLeft} ч.` : `${minutesLeft} мин.`;
}

async function getCooldownRemaining(videoId) {
  const result = await db.execute({
    sql: 'SELECT fetched_at FROM stats_snapshots WHERE video_id = ? ORDER BY fetched_at DESC LIMIT 1',
    args: [videoId],
  });
  const lastFetchedAt = parseFetchedAt(result.rows[0]?.fetched_at);
  if (!lastFetchedAt) return 0;
  return Math.max(0, COOLDOWN_MS - (Date.now() - lastFetchedAt.getTime()));
}

function toSummaryMap(rows) {
  const map = {};
  rows.forEach(row => {
    map[row.platform] = {
      total_videos: row.total_videos,
      total_views: row.total_views,
      total_likes: row.total_likes,
      total_comments: row.total_comments,
      total_saves: row.total_saves,
      total_shares: row.total_shares,
      avg_er: row.avg_er,
    };
  });
  return map;
}

async function getSummaryByPlatform({ wsId, from, to, creator_id }) {
  let filter = 'WHERE 1=1';
  const args = [];
  if (wsId) { filter += ' AND v.workspace_id = ?'; args.push(wsId); }
  if (creator_id) { filter += ' AND v.creator_id = ?'; args.push(creator_id); }
  if (from) { filter += ' AND v.published_at >= ?'; args.push(from); }
  if (to) { filter += ' AND v.published_at <= ?'; args.push(to); }

  const result = await db.execute({ sql: `
    SELECT
      v.platform,
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
    GROUP BY v.platform
  `, args });
  return toSummaryMap(result.rows);
}

async function getByCreatorRows({ wsId, from, to, platform }) {
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
  return result.rows;
}

async function getDashboardFunnelPeriods(wsId) {
  const result = await db.execute({
    sql: 'SELECT id, creator_id, NULL as payout FROM funnel_periods WHERE workspace_id = ?',
    args: [wsId],
  });
  return result.rows;
}

router.get('/dashboard', async (req, res) => {
  try {
    const { from, to, compare_from, compare_to, creator_id, include_funnel } = req.query;
    const wsId = req.workspaceId;
    if (!wsId) return res.status(400).json({ error: 'workspace_id required' });

    const requests = [
      getSummaryByPlatform({ wsId, from, to, creator_id }),
      getByCreatorRows({ wsId, from, to }),
    ];

    const hasCompare = Boolean(compare_from || compare_to);
    if (hasCompare) {
      requests.push(
        getSummaryByPlatform({ wsId, from: compare_from, to: compare_to, creator_id }),
        getByCreatorRows({ wsId, from: compare_from, to: compare_to }),
      );
    }

    if (include_funnel === '1') {
      requests.push(getDashboardFunnelPeriods(wsId).catch(() => []));
    }

    const results = await Promise.all(requests);
    const [summaryByPlat, byCreator] = results;
    let cursor = 2;
    const response = {
      summaryByPlat,
      byCreator,
      prevSummaryByPlat: {},
      prevByCreator: [],
      funnelPeriods: [],
    };

    if (hasCompare) {
      response.prevSummaryByPlat = results[cursor++] || {};
      response.prevByCreator = results[cursor++] || [];
    }

    if (include_funnel === '1') {
      response.funnelPeriods = results[cursor] || [];
    }

    res.json(response);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const { from, to, platform, creator_id } = req.query;
    const wsId = req.workspaceId;
    if (!wsId) return res.status(400).json({ error: 'workspace_id required' });
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
    const wsId = req.workspaceId;
    if (!wsId) return res.json([]);
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
  let lockedVideoId = null;
  try {
    const videoId = parseInt(req.params.id);

    const result = await db.execute({ sql: 'SELECT * FROM videos WHERE id = ?', args: [videoId] });
    const video = result.rows[0];
    if (!video) return res.status(404).json({ error: 'Видео не найдено' });

    // Проверяем что видео принадлежит воркспейсу пользователя
    const wsId = req.workspaceId;
    if (!wsId) return res.status(400).json({ error: 'workspace_id required' });
    if (video.workspace_id && String(video.workspace_id) !== String(wsId)) {
      return res.status(403).json({ error: 'Нет доступа к этому видео' });
    }

    const cooldownRemaining = await getCooldownRemaining(videoId);
    if (cooldownRemaining > 0) {
      return res.status(429).json({
        error: `Обновить можно раз в 12 часов. Следующее обновление через ${formatCooldown(cooldownRemaining)}.`
      });
    }

    if (inProgress.has(videoId)) {
      return res.status(409).json({ error: 'Обновление уже выполняется' });
    }

    inProgress.set(videoId, true);
    lockedVideoId = videoId;

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
  } finally {
    if (lockedVideoId != null) inProgress.delete(lockedVideoId);
  }
});

export default router;

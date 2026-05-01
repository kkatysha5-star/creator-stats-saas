import { Router } from 'express';
import { db } from '../db.js';
import { fetchStatsForVideo, detectPlatform, extractVideoId } from '../fetchers.js';

const router = Router();
const COOLDOWN_MS = 12 * 60 * 60 * 1000;

function parseFetchedAt(value) {
  if (!value) return null;
  const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T') + 'Z';
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function hasFreshSnapshot(videoId) {
  const result = await db.execute({
    sql: 'SELECT fetched_at FROM stats_snapshots WHERE video_id = ? ORDER BY fetched_at DESC LIMIT 1',
    args: [videoId],
  });
  const lastFetchedAt = parseFetchedAt(result.rows[0]?.fetched_at);
  return Boolean(lastFetchedAt && Date.now() - lastFetchedAt.getTime() < COOLDOWN_MS);
}

async function fetchStatsInBackground(video, postId) {
  try {
    if (await hasFreshSnapshot(video.id)) return;
    const stats = await fetchStatsForVideo(video);
    const er = stats.views > 0 ? ((stats.likes + stats.comments + (stats.saves || 0)) / stats.views * 100) : 0;
    await db.execute({ sql: 'INSERT INTO stats_snapshots (video_id, views, likes, comments, saves, shares, er) VALUES (?, ?, ?, ?, ?, ?, ?)', args: [video.id, stats.views, stats.likes, stats.comments, stats.saves, stats.shares, er] });
    if (stats.title) {
      await db.execute({ sql: 'UPDATE posts SET title = COALESCE(title, ?), published_at = COALESCE(published_at, ?) WHERE id = ?', args: [stats.title, stats.published_at, postId] });
      await db.execute({ sql: 'UPDATE videos SET title = ?, published_at = COALESCE(published_at, ?) WHERE id = ?', args: [stats.title, stats.published_at, video.id] });
    }
  } catch (e) {
    console.warn('Background stats fetch failed:', e.message);
    try {
      await db.execute({ sql: 'UPDATE videos SET last_error = ? WHERE id = ?', args: [e.message, video.id] });
    } catch {}
  }
}

router.get('/', async (req, res) => {
  try {
    const { creator_id, from, to } = req.query;
    const wsId = req.workspaceId;
    if (!wsId) return res.json([]);
    let filter = 'WHERE 1=1';
    const args = [];
    if (wsId) { filter += ' AND p.workspace_id = ?'; args.push(wsId); }
    if (creator_id) { filter += ' AND p.creator_id = ?'; args.push(creator_id); }
    if (from) { filter += ' AND p.published_at >= ?'; args.push(from); }
    if (to) { filter += ' AND p.published_at <= ?'; args.push(to); }

    const postsResult = await db.execute({ sql: `
      SELECT p.id, p.title, p.published_at, p.added_at, p.creator_id, c.name as creator_name, c.avatar_color
      FROM posts p JOIN creators c ON p.creator_id = c.id
      ${filter}
      ORDER BY p.creator_id ASC, p.published_at ASC, p.added_at ASC
    `, args });

    // Сортируем по дате + id для стабильного порядка (тайбрейкер при одинаковой дате)
    const posts = [...postsResult.rows].sort((a, b) => {
      const da = a.published_at || a.added_at || '';
      const db2 = b.published_at || b.added_at || '';
      if (da !== db2) return da.localeCompare(db2);
      return a.id - b.id;
    });

    const creatorCounters = {};
    const postsWithNum = posts.map(post => {
      if (!creatorCounters[post.creator_id]) creatorCounters[post.creator_id] = 0;
      creatorCounters[post.creator_id]++;
      return { ...post, post_num: creatorCounters[post.creator_id] };
    });

    // Показываем новые ролики первыми, номера уже корректны
    postsWithNum.sort((a, b) => {
      const da = a.published_at || a.added_at || '';
      const db2 = b.published_at || b.added_at || '';
      if (db2 !== da) return db2.localeCompare(da);
      return b.id - a.id;
    });

    const postIds = postsWithNum.map(post => post.id);
    let videosByPost = {};

    if (postIds.length) {
      const placeholders = postIds.map(() => '?').join(',');
      const videosResult = await db.execute({ sql: `
        SELECT v.*, s.views, s.likes, s.comments, s.saves, s.shares, s.er, s.fetched_at as stats_updated_at
        FROM videos v
        LEFT JOIN (
          SELECT video_id, views, likes, comments, saves, shares, er, fetched_at,
                 ROW_NUMBER() OVER (PARTITION BY video_id ORDER BY fetched_at DESC) as rn
          FROM stats_snapshots
        ) s ON s.video_id = v.id AND s.rn = 1
        WHERE v.post_id IN (${placeholders})
      `, args: postIds });

      videosByPost = videosResult.rows.reduce((acc, video) => {
        const postId = video.post_id;
        if (!acc[postId]) acc[postId] = [];
        acc[postId].push(video);
        return acc;
      }, {});
    }

    const result = postsWithNum.map(post => {
      const videos = videosByPost[post.id] || [];
      const totals = videos.reduce((acc, v) => ({
        views: acc.views + (v.views || 0),
        likes: acc.likes + (v.likes || 0),
        comments: acc.comments + (v.comments || 0),
        saves: acc.saves + (v.saves || 0),
        shares: acc.shares + (v.shares || 0),
      }), { views: 0, likes: 0, comments: 0, saves: 0, shares: 0 });

      const avg_er = totals.views > 0 ? ((totals.likes + totals.comments + totals.saves) / totals.views * 100) : 0;
      return { ...post, videos, totals: { ...totals, avg_er } };
    });

    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { creator_id, url, published_at } = req.body;
    if (!creator_id) return res.status(400).json({ error: 'creator_id is required' });
    if (!url) return res.status(400).json({ error: 'url is required' });
    if (!req.user) return res.status(401).json({ error: 'Необходима авторизация' });
    if (!req.workspaceId) return res.status(400).json({ error: 'workspace_id required' });

    const platform = detectPlatform(url);
    if (!platform) return res.status(400).json({ error: 'Unsupported platform URL' });

    const creatorCheck = await db.execute({
      sql: 'SELECT id FROM creators WHERE id = ? AND workspace_id = ?',
      args: [creator_id, req.workspaceId],
    });
    if (!creatorCheck.rows.length) return res.status(403).json({ error: 'Нет доступа к этому креатору' });

    const wsId = req.workspaceId;
    const postResult = await db.execute({ sql: 'INSERT INTO posts (creator_id, published_at, workspace_id) VALUES (?, ?, ?)', args: [creator_id, published_at || null, wsId] });
    const postId = postResult.lastInsertRowid;

    const video_id = extractVideoId(url, platform);
    const vidResult = await db.execute({ sql: 'INSERT INTO videos (post_id, creator_id, platform, url, video_id, published_at, workspace_id) VALUES (?, ?, ?, ?, ?, ?, ?)', args: [postId, creator_id, platform, url, video_id || null, published_at || null, wsId] });
    const videoDbId = vidResult.lastInsertRowid;

    const videoRow = await db.execute({ sql: 'SELECT * FROM videos WHERE id = ?', args: [videoDbId] });
    const video = videoRow.rows[0];

    const postRow = await db.execute({ sql: 'SELECT * FROM posts WHERE id = ?', args: [postId] });
    res.status(201).json(postRow.rows[0]);
    fetchStatsInBackground(video, postId);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/videos', async (req, res) => {
  try {
    const { url } = req.body;
    if (!req.user) return res.status(401).json({ error: 'Необходима авторизация' });
    if (!req.workspaceId) return res.status(400).json({ error: 'workspace_id required' });
    const postRow = await db.execute({ sql: 'SELECT * FROM posts WHERE id = ?', args: [req.params.id] });
    if (!postRow.rows.length) return res.status(404).json({ error: 'Post not found' });
    const post = postRow.rows[0];
    if (String(post.workspace_id) !== String(req.workspaceId)) {
      return res.status(403).json({ error: 'Нет доступа к этому workspace' });
    }

    const platform = detectPlatform(url);
    if (!platform) return res.status(400).json({ error: 'Unsupported platform URL' });

    const existing = await db.execute({ sql: 'SELECT id FROM videos WHERE post_id = ? AND platform = ?', args: [post.id, platform] });
    if (existing.rows.length) return res.status(409).json({ error: `Уже есть ссылка на ${platform}` });

    const video_id = extractVideoId(url, platform);
    const wsId = req.workspaceId;
    const vidResult = await db.execute({ sql: 'INSERT INTO videos (post_id, creator_id, platform, url, video_id, published_at, workspace_id) VALUES (?, ?, ?, ?, ?, ?, ?)', args: [post.id, post.creator_id, platform, url, video_id || null, post.published_at || null, wsId] });
    const videoDbId = vidResult.lastInsertRowid;

    const videoRow = await db.execute({ sql: 'SELECT * FROM videos WHERE id = ?', args: [videoDbId] });
    const video = videoRow.rows[0];

    const final = await db.execute({ sql: 'SELECT * FROM videos WHERE id = ?', args: [videoDbId] });
    res.status(201).json(final.rows[0]);
    fetchStatsInBackground(video, post.id);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, published_at } = req.body;
    if (!req.user) return res.status(401).json({ error: 'Необходима авторизация' });
    if (!req.workspaceId) return res.status(400).json({ error: 'workspace_id required' });
    const postCheck = await db.execute({ sql: 'SELECT workspace_id FROM posts WHERE id = ?', args: [req.params.id] });
    if (!postCheck.rows.length) return res.status(404).json({ error: 'Post not found' });
    if (String(postCheck.rows[0].workspace_id) !== String(req.workspaceId)) {
      return res.status(403).json({ error: 'Нет доступа к этому workspace' });
    }
    await db.execute({ sql: 'UPDATE posts SET title = ?, published_at = ? WHERE id = ?', args: [title, published_at, req.params.id] });
    const result = await db.execute({ sql: 'SELECT * FROM posts WHERE id = ?', args: [req.params.id] });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Необходима авторизация' });
    if (!req.workspaceId) return res.status(400).json({ error: 'workspace_id required' });
    const postCheck = await db.execute({ sql: 'SELECT workspace_id FROM posts WHERE id = ?', args: [req.params.id] });
    if (!postCheck.rows.length) return res.status(404).json({ error: 'Post not found' });
    if (String(postCheck.rows[0].workspace_id) !== String(req.workspaceId)) {
      return res.status(403).json({ error: 'Нет доступа к этому workspace' });
    }
    // Удаляем видео, привязанные к этому посту
    await db.execute({ sql: 'DELETE FROM videos WHERE post_id = ?', args: [req.params.id] });
    await db.execute({ sql: 'DELETE FROM posts WHERE id = ?', args: [req.params.id] });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id/videos/:videoId', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Необходима авторизация' });
    if (!req.workspaceId) return res.status(400).json({ error: 'workspace_id required' });
    const postCheck = await db.execute({ sql: 'SELECT workspace_id FROM posts WHERE id = ?', args: [req.params.id] });
    if (!postCheck.rows.length) return res.status(404).json({ error: 'Post not found' });
    if (String(postCheck.rows[0].workspace_id) !== String(req.workspaceId)) {
      return res.status(403).json({ error: 'Нет доступа к этому workspace' });
    }
    await db.execute({ sql: 'DELETE FROM videos WHERE id = ? AND post_id = ?', args: [req.params.videoId, req.params.id] });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;

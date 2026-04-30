import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireActivePlan, PLAN_LIMITS } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const wsId = req.workspaceId || req.query.workspace_id;
    if (!wsId) return res.json([]);
    const result = await db.execute({
      sql: req.userRole === 'creator'
        ? `SELECT * FROM creators
           WHERE workspace_id = ? AND (user_id = ? OR lower(email) = lower(?))
           ORDER BY name`
        : 'SELECT * FROM creators WHERE workspace_id = ? ORDER BY name',
      args: req.userRole === 'creator' ? [wsId, req.user.id, req.user.email] : [wsId],
    });
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const wsId = req.workspaceId || req.query.workspace_id;
    if (!wsId) return res.status(400).json({ error: 'workspace_id required' });

    const result = await db.execute({
      sql: `SELECT * FROM creators
            WHERE workspace_id = ? AND (user_id = ? OR lower(email) = lower(?))
            LIMIT 1`,
      args: [wsId, req.user.id, req.user.email],
    });

    res.json({ creator: result.rows[0] || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const result = await db.execute({ sql: 'SELECT * FROM creators WHERE id = ?', args: [req.params.id] });
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    const creator = result.rows[0];
    if (req.workspaceId && String(creator.workspace_id) !== String(req.workspaceId)) {
      return res.status(403).json({ error: 'Нет доступа к этому workspace' });
    }
    if (req.userRole === 'creator') {
      const isOwn = Number(creator.user_id) === Number(req.user.id)
        || creator.email?.toLowerCase() === req.user.email?.toLowerCase();
      if (!isOwn) return res.status(403).json({ error: 'Недостаточно прав' });
    }
    res.json(creator);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, requireActivePlan, async (req, res) => {
  if (!req.user?.email_verified) return res.status(403).json({ error: 'email_not_verified' });

  try {
    const wsId = req.workspaceId || req.body.workspace_id;
    if (!wsId) return res.status(400).json({ error: 'workspace_id required' });

    // Проверяем лимит по плану
    const workspace = req.workspace;
    const plan = workspace?.plan || 'trial';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.trial;

    const countResult = await db.execute({
      sql: 'SELECT COUNT(*) as cnt FROM creators WHERE workspace_id = ?',
      args: [wsId]
    });
    const currentCount = Number(countResult.rows[0].cnt);

    if (currentCount >= limits.creators) {
      const planNames = { trial: 'пробном (1 креатор)', start: 'Start (5 креаторов)', pro: 'Pro (20 креаторов)' };
      if (plan === 'pro' && currentCount >= 20) {
        return res.status(403).json({
          error: 'creator_limit',
          message: 'Достигнут лимит Pro (20 креаторов). Обсудите индивидуальные условия.',
          discuss: true,
        });
      }
      return res.status(403).json({
        error: 'creator_limit',
        message: `Достигнут лимит на ${planNames[plan] || plan}. Перейдите на более высокий тариф.`,
        limit: limits.creators,
        current: currentCount,
      });
    }

    const { name, username, email, avatar_color, video_plan_count, video_plan_period, reach_plan, daily_rate } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const colors = ['#7c6cfc','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#06b6d4'];
    const color = avatar_color || colors[Math.floor(Math.random() * colors.length)];
    const result = await db.execute({
      sql: 'INSERT INTO creators (name, username, email, user_id, avatar_color, video_plan_count, video_plan_period, reach_plan, daily_rate, workspace_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [name, username || null, email || null, email?.toLowerCase() === req.user.email?.toLowerCase() ? req.user.id : null, color, video_plan_count || 0, video_plan_period || 'month', reach_plan || 0, daily_rate || 0, wsId]
    });
    const creator = await db.execute({ sql: 'SELECT * FROM creators WHERE id = ?', args: [result.lastInsertRowid] });
    res.status(201).json(creator.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireAuth, requireActivePlan, async (req, res) => {
  try {
    const { name, username, email, avatar_color, video_plan_count, video_plan_period, reach_plan, daily_rate, period_start } = req.body;
    const existing = await db.execute({ sql: 'SELECT * FROM creators WHERE id = ?', args: [req.params.id] });
    if (!existing.rows.length) return res.status(404).json({ error: 'Not found' });
    const e = existing.rows[0];
    const nextEmail = email ?? e.email;
    const nextUserId = nextEmail?.toLowerCase() === req.user.email?.toLowerCase() ? req.user.id : e.user_id;
    await db.execute({
      sql: 'UPDATE creators SET name = ?, username = ?, email = ?, user_id = ?, avatar_color = ?, video_plan_count = ?, video_plan_period = ?, reach_plan = ?, daily_rate = ?, period_start = ? WHERE id = ?',
      args: [name || e.name, username ?? e.username, nextEmail, nextUserId, avatar_color || e.avatar_color, video_plan_count ?? e.video_plan_count, video_plan_period ?? e.video_plan_period, reach_plan ?? e.reach_plan, daily_rate ?? e.daily_rate, period_start ?? e.period_start ?? null, req.params.id]
    });
    const updated = await db.execute({ sql: 'SELECT * FROM creators WHERE id = ?', args: [req.params.id] });
    res.json(updated.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, requireActivePlan, async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM creators WHERE id = ?', args: [req.params.id] });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;

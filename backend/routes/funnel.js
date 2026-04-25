import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, PLAN_LIMITS } from '../middleware/auth.js';

const router = Router();

// Безопасная проверка пароля — false если env не задан
function isAdmin(req) {
  const pwd = process.env.ADMIN_PASSWORD;
  if (!pwd) return false;
  return req.headers['x-admin-password'] === pwd;
}

// Проверяет что у залогиненного пользователя есть доступ к воронке по плану
function requireFunnelPlan(req, res, next) {
  const workspace = req.workspace;
  if (!workspace) {
    return res.status(403).json({ error: 'plan_feature_unavailable', message: 'Воронка продаж доступна только на тарифе Pro.' });
  }
  const limits = PLAN_LIMITS[workspace.plan] || PLAN_LIMITS.trial;
  if (!limits.funnel) {
    return res.status(403).json({ error: 'plan_feature_unavailable', message: 'Воронка продаж доступна только на тарифе Pro.' });
  }
  next();
}

// Все роуты требуют авторизации + Pro-плана
router.use(requireAuth, requireFunnelPlan);

// Получить все периоды со снимками
router.get('/periods', async (req, res) => {
  try {
    const wsId = req.workspaceId;
    const periodsResult = await db.execute({
      sql: `SELECT fp.*, c.name as creator_name, c.avatar_color
            FROM funnel_periods fp
            JOIN creators c ON fp.creator_id = c.id
            WHERE fp.workspace_id = ?
            ORDER BY fp.creator_id, fp.date_from DESC`,
      args: [wsId]
    });

    const periods = periodsResult.rows;

    const result = await Promise.all(periods.map(async (p) => {
      const snapResult = await db.execute({
        sql: 'SELECT * FROM funnel_snapshots WHERE period_id = ? ORDER BY recorded_at ASC',
        args: [p.id]
      });

      const snapshots = snapResult.rows;
      const latest = snapshots[snapshots.length - 1] || null;

      const viewsResult = await db.execute({
        sql: `SELECT SUM(COALESCE(s.views, 0)) as total_views
              FROM videos v
              LEFT JOIN (
                SELECT video_id, views,
                       ROW_NUMBER() OVER (PARTITION BY video_id ORDER BY fetched_at DESC) as rn
                FROM stats_snapshots
              ) s ON s.video_id = v.id AND s.rn = 1
              WHERE v.creator_id = ?
                AND v.published_at >= ?
                AND (? IS NULL OR v.published_at <= ?)`,
        args: [p.creator_id, p.date_from, p.date_to, p.date_to]
      });

      const totalViews = viewsResult.rows[0]?.total_views || 0;
      const visits = latest?.visits || 0;
      const cart = latest?.cart || 0;
      const orders = latest?.orders || 0;

      const conv_visit_reach  = totalViews > 0 ? (visits / totalViews * 100) : null;
      const conv_cart_visit   = visits > 0     ? (cart / visits * 100)       : null;
      const conv_cart_reach   = totalViews > 0 ? (cart / totalViews * 100)   : null;
      const conv_order_cart   = cart > 0       ? (orders / cart * 100)       : null;
      const conv_order_reach  = totalViews > 0 ? (orders / totalViews * 100) : null;
      const cpm = (p.payout && totalViews > 0) ? (p.payout / totalViews * 1000) : null;
      const cac = (p.payout && orders > 0)     ? (p.payout / orders)            : null;

      return {
        ...p,
        payout: undefined,
        total_views: totalViews,
        visits, cart, orders,
        conv_visit_reach, conv_cart_visit, conv_cart_reach,
        conv_order_cart, conv_order_reach,
        cpm, cac,
        snapshots,
      };
    }));

    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Приватные данные — только для админа
router.get('/periods/private', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const result = await db.execute({
      sql: `SELECT fp.id, fp.payout,
              (SELECT visits FROM funnel_snapshots WHERE period_id = fp.id ORDER BY recorded_at DESC LIMIT 1) as visits,
              (SELECT orders FROM funnel_snapshots WHERE period_id = fp.id ORDER BY recorded_at DESC LIMIT 1) as orders
            FROM funnel_periods fp
            WHERE fp.workspace_id = ?`,
      args: [req.workspaceId]
    });

    const rows = result.rows.map(r => ({
      id: r.id,
      payout: r.payout,
      cac: (r.payout && r.orders > 0) ? (r.payout / r.orders) : null,
    }));

    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Создать период — только админ
router.post('/periods', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { creator_id, label, date_from, date_to } = req.body;
    if (!creator_id || !label || !date_from) return res.status(400).json({ error: 'Заполните все поля' });
    const r = await db.execute({
      sql: 'INSERT INTO funnel_periods (creator_id, label, date_from, date_to, is_active, workspace_id) VALUES (?, ?, ?, ?, 1, ?)',
      args: [creator_id, label, date_from, date_to || null, req.workspaceId]
    });
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Обновить период — только админ
router.put('/periods/:id', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { date_to, payout, is_active, label } = req.body;
    await db.execute({
      sql: 'UPDATE funnel_periods SET date_to = ?, payout = ?, is_active = ?, label = ? WHERE id = ? AND workspace_id = ?',
      args: [date_to || null, payout || null, is_active ?? 1, label, req.params.id, req.workspaceId]
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Удалить период — только админ
router.delete('/periods/:id', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  try {
    await db.execute({
      sql: 'DELETE FROM funnel_periods WHERE id = ? AND workspace_id = ?',
      args: [req.params.id, req.workspaceId]
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Добавить снимок — только админ
router.post('/periods/:id/snapshots', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { visits, cart, orders, note } = req.body;
    await db.execute({
      sql: 'INSERT INTO funnel_snapshots (period_id, visits, cart, orders, note) VALUES (?, ?, ?, ?, ?)',
      args: [req.params.id, visits || 0, cart || 0, orders || 0, note || null]
    });
    res.status(201).json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Удалить снимок — только админ
router.delete('/snapshots/:id', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  try {
    await db.execute({ sql: 'DELETE FROM funnel_snapshots WHERE id = ?', args: [req.params.id] });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;

import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, PLAN_LIMITS } from '../middleware/auth.js';

const router = Router();

function canEdit(req) {
  return req.userRole === 'owner' || req.userRole === 'manager';
}

async function getWorkspaceCreators(wsId) {
  const result = await db.execute({
    sql: 'SELECT id, name FROM creators WHERE workspace_id = ? ORDER BY name',
    args: [wsId],
  });
  return result.rows;
}

async function getLabelTemplate(wsId, label) {
  const result = await db.execute({
    sql: `SELECT date_from, date_to, is_active
          FROM funnel_periods
          WHERE workspace_id = ? AND label = ?
          ORDER BY date_from ASC, creator_id ASC
          LIMIT 1`,
    args: [wsId, label],
  });
  return result.rows[0] || null;
}

async function ensureFunnelPeriod({ wsId, creatorId, label, dateFrom, dateTo, isActive = 1 }) {
  const existing = await db.execute({
    sql: 'SELECT id FROM funnel_periods WHERE workspace_id = ? AND creator_id = ? AND label = ?',
    args: [wsId, creatorId, label],
  });
  if (existing.rows.length) {
    return { id: Number(existing.rows[0].id), created: false };
  }

  const insert = await db.execute({
    sql: 'INSERT INTO funnel_periods (creator_id, label, date_from, date_to, is_active, workspace_id) VALUES (?, ?, ?, ?, ?, ?)',
    args: [creatorId, label, dateFrom, dateTo || null, isActive ? 1 : 0, wsId],
  });
  return { id: Number(insert.lastInsertRowid), created: true };
}

async function syncFunnelLabel(wsId, label) {
  if (!label) return { created: 0, skipped: 0 };

  const [creators, template] = await Promise.all([
    getWorkspaceCreators(wsId),
    getLabelTemplate(wsId, label),
  ]);

  if (!template) return { created: 0, skipped: creators.length };

  let created = 0;
  let skipped = 0;
  for (const creator of creators) {
    const result = await ensureFunnelPeriod({
      wsId,
      creatorId: creator.id,
      label,
      dateFrom: template.date_from,
      dateTo: template.date_to,
      isActive: template.is_active,
    });
    if (result.created) created += 1;
    else skipped += 1;
  }
  return { created, skipped };
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

    const periodIds = periods.map(p => p.id);
    let snapshotsByPeriod = {};
    let viewsByPeriod = {};

    if (periodIds.length) {
      const placeholders = periodIds.map(() => '?').join(',');
      const snapResult = await db.execute({
        sql: `SELECT * FROM funnel_snapshots
              WHERE period_id IN (${placeholders})
              ORDER BY period_id ASC, recorded_at ASC`,
        args: periodIds
      });

      snapshotsByPeriod = snapResult.rows.reduce((acc, snapshot) => {
        const periodId = snapshot.period_id;
        if (!acc[periodId]) acc[periodId] = [];
        acc[periodId].push(snapshot);
        return acc;
      }, {});

      const viewsResult = await db.execute({
        sql: `SELECT fp.id as period_id, SUM(COALESCE(s.views, 0)) as total_views
              FROM funnel_periods fp
              LEFT JOIN videos v
                ON v.creator_id = fp.creator_id
                AND v.published_at >= fp.date_from
                AND (fp.date_to IS NULL OR v.published_at <= fp.date_to)
              LEFT JOIN (
                SELECT video_id, views,
                       ROW_NUMBER() OVER (PARTITION BY video_id ORDER BY fetched_at DESC) as rn
                FROM stats_snapshots
              ) s ON s.video_id = v.id AND s.rn = 1
              WHERE fp.id IN (${placeholders})
              GROUP BY fp.id`,
        args: periodIds
      });

      viewsByPeriod = viewsResult.rows.reduce((acc, row) => {
        acc[row.period_id] = row.total_views || 0;
        return acc;
      }, {});
    }

    const result = periods.map((p) => {
      const snapshots = snapshotsByPeriod[p.id] || [];
      const latest = snapshots[snapshots.length - 1] || null;
      const totalViews = viewsByPeriod[p.id] || 0;
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
    });

    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Синхронизировать выбранный период с текущими креаторами workspace
router.post('/periods/sync', async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { label } = req.body;
    const result = await syncFunnelLabel(req.workspaceId, label);
    res.json({ ok: true, ...result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Ручное добавление креатора в выбранный период
router.post('/periods/add-creator', async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { creator_id, label, date_from, date_to } = req.body;
    if (!creator_id || !label || !date_from) {
      return res.status(400).json({ error: 'Заполните все поля' });
    }

    const creatorCheck = await db.execute({
      sql: 'SELECT id FROM creators WHERE id = ? AND workspace_id = ?',
      args: [creator_id, req.workspaceId],
    });
    if (!creatorCheck.rows.length) {
      return res.status(404).json({ error: 'Креатор не найден' });
    }

    const result = await ensureFunnelPeriod({
      wsId: req.workspaceId,
      creatorId: creator_id,
      label,
      dateFrom: date_from,
      dateTo: date_to || null,
      isActive: 1,
    });

    res.status(result.created ? 201 : 200).json({ ok: true, period_id: result.id, created: result.created });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Приватные данные — только для owner/manager
router.get('/periods/private', async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: 'Forbidden' });
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

// Создать период — только owner/manager
router.post('/periods', async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: 'Forbidden' });
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

// Обновить период — только owner/manager
router.put('/periods/:id', async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { date_to, payout, is_active, label } = req.body;
    await db.execute({
      sql: 'UPDATE funnel_periods SET date_to = ?, payout = ?, is_active = ?, label = ? WHERE id = ? AND workspace_id = ?',
      args: [date_to || null, payout || null, is_active ?? 1, label, req.params.id, req.workspaceId]
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Удалить период — только owner/manager
router.delete('/periods/:id', async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: 'Forbidden' });
  try {
    await db.execute({
      sql: 'DELETE FROM funnel_periods WHERE id = ? AND workspace_id = ?',
      args: [req.params.id, req.workspaceId]
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Добавить снимок — только owner/manager
router.post('/periods/:id/snapshots', async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { visits, cart, orders, note } = req.body;
    await db.execute({
      sql: 'INSERT INTO funnel_snapshots (period_id, visits, cart, orders, note) VALUES (?, ?, ?, ?, ?)',
      args: [req.params.id, visits || 0, cart || 0, orders || 0, note || null]
    });
    res.status(201).json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Удалить снимок — только owner/manager
router.delete('/snapshots/:id', async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: 'Forbidden' });
  try {
    await db.execute({ sql: 'DELETE FROM funnel_snapshots WHERE id = ?', args: [req.params.id] });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Массовый импорт данных из Excel/CSV — только owner/manager
router.post('/import', async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: 'Forbidden' });
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'Нет данных' });

  const wsId = req.workspaceId;
  const results = [];
  for (const row of rows) {
    try {
      const { creator_id, label, date_from, date_to, total_views, visits, cart, orders, payout } = row;
      if (!creator_id || !label || !date_from) {
        results.push({ error: 'Пропущены обязательные поля' });
        continue;
      }

      const existing = await db.execute({
        sql: 'SELECT id FROM funnel_periods WHERE creator_id = ? AND label = ? AND workspace_id = ?',
        args: [creator_id, label, wsId],
      });

      let periodId;
      if (existing.rows.length > 0) {
        periodId = Number(existing.rows[0].id);
        const sets = [];
        const args = [];
        if (payout != null) { sets.push('payout = ?'); args.push(payout); }
        if (date_to)        { sets.push('date_to = ?'); args.push(date_to); }
        if (sets.length > 0) {
          args.push(periodId);
          await db.execute({ sql: `UPDATE funnel_periods SET ${sets.join(', ')} WHERE id = ?`, args });
        }
        if (total_views != null) {
          try { await db.execute({ sql: 'UPDATE funnel_periods SET total_views_override = ? WHERE id = ?', args: [total_views, periodId] }); } catch {}
        }
      } else {
        const r = await db.execute({
          sql: 'INSERT INTO funnel_periods (creator_id, label, date_from, date_to, is_active, payout, workspace_id) VALUES (?, ?, ?, ?, 1, ?, ?)',
          args: [creator_id, label, date_from, date_to || null, payout ?? null, wsId],
        });
        periodId = Number(r.lastInsertRowid);
        if (total_views != null) {
          try { await db.execute({ sql: 'UPDATE funnel_periods SET total_views_override = ? WHERE id = ?', args: [total_views, periodId] }); } catch {}
        }
      }

      if (visits != null || cart != null || orders != null) {
        await db.execute({
          sql: 'INSERT INTO funnel_snapshots (period_id, visits, cart, orders, note) VALUES (?, ?, ?, ?, ?)',
          args: [periodId, visits ?? 0, cart ?? 0, orders ?? 0, 'Импорт из Excel'],
        });
      }

      results.push({ creator_id, label, period_id: periodId, ok: true });
    } catch (e) {
      results.push({ error: e.message });
    }
  }
  res.json({ results });
});

export default router;

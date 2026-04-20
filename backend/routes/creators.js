import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const wsId = req.workspaceId || req.query.workspace_id;
    if (!wsId) return res.json([]);
    const result = await db.execute({ sql: 'SELECT * FROM creators WHERE workspace_id = ? ORDER BY name', args: [wsId] });
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.execute({ sql: 'SELECT * FROM creators WHERE id = ?', args: [req.params.id] });
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, username, email, avatar_color, video_plan_count, video_plan_period, reach_plan, daily_rate } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const colors = ['#7c6cfc','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#06b6d4'];
    const color = avatar_color || colors[Math.floor(Math.random() * colors.length)];
    const wsId = req.workspaceId || req.body.workspace_id;
    const result = await db.execute({ sql: 'INSERT INTO creators (name, username, email, avatar_color, video_plan_count, video_plan_period, reach_plan, daily_rate, workspace_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', args: [name, username || null, email || null, color, video_plan_count || 0, video_plan_period || 'month', reach_plan || 0, daily_rate || 0, wsId || 1] });
    const creator = await db.execute({ sql: 'SELECT * FROM creators WHERE id = ?', args: [result.lastInsertRowid] });
    res.status(201).json(creator.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, username, email, avatar_color, video_plan_count, video_plan_period, reach_plan, daily_rate } = req.body;
    const existing = await db.execute({ sql: 'SELECT * FROM creators WHERE id = ?', args: [req.params.id] });
    if (!existing.rows.length) return res.status(404).json({ error: 'Not found' });
    const e = existing.rows[0];
    await db.execute({ sql: 'UPDATE creators SET name = ?, username = ?, email = ?, avatar_color = ?, video_plan_count = ?, video_plan_period = ?, reach_plan = ?, daily_rate = ? WHERE id = ?', args: [name || e.name, username ?? e.username, email ?? e.email, avatar_color || e.avatar_color, video_plan_count ?? e.video_plan_count, video_plan_period ?? e.video_plan_period, reach_plan ?? e.reach_plan, daily_rate ?? e.daily_rate, req.params.id] });
    const updated = await db.execute({ sql: 'SELECT * FROM creators WHERE id = ?', args: [req.params.id] });
    res.json(updated.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM creators WHERE id = ?', args: [req.params.id] });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;

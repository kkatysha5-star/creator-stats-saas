import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM creators ORDER BY name');
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
    const { name, username, avatar_color } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const colors = ['#7c6cfc','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#06b6d4'];
    const color = avatar_color || colors[Math.floor(Math.random() * colors.length)];
    const result = await db.execute({ sql: 'INSERT INTO creators (name, username, avatar_color) VALUES (?, ?, ?)', args: [name, username || null, color] });
    const creator = await db.execute({ sql: 'SELECT * FROM creators WHERE id = ?', args: [result.lastInsertRowid] });
    res.status(201).json(creator.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, username, avatar_color } = req.body;
    const existing = await db.execute({ sql: 'SELECT * FROM creators WHERE id = ?', args: [req.params.id] });
    if (!existing.rows.length) return res.status(404).json({ error: 'Not found' });
    const e = existing.rows[0];
    await db.execute({ sql: 'UPDATE creators SET name = ?, username = ?, avatar_color = ? WHERE id = ?', args: [name || e.name, username ?? e.username, avatar_color || e.avatar_color, req.params.id] });
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

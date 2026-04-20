import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Создать воркспейс (онбординг)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Введите название' });

    // Генерируем slug
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9а-яё\s]/gi, '')
      .replace(/\s+/g, '-')
      .slice(0, 30) + '-' + Date.now().toString().slice(-4);

    const result = await db.execute({
      sql: 'INSERT INTO workspaces (name, slug, owner_id) VALUES (?, ?, ?)',
      args: [name, slug, req.user.id]
    });
    const wsId = Number(result.lastInsertRowid);

    // Добавляем создателя как owner
    await db.execute({
      sql: 'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)',
      args: [wsId, req.user.id, 'owner']
    });

    const ws = await db.execute({ sql: 'SELECT * FROM workspaces WHERE id = ?', args: [wsId] });
    res.status(201).json(ws.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Получить воркспейс
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT w.*, wm.role FROM workspaces w
            JOIN workspace_members wm ON wm.workspace_id = w.id
            WHERE w.id = ? AND wm.user_id = ?`,
      args: [req.params.id, req.user.id]
    });
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Получить членов воркспейса
router.get('/:id/members', requireAuth, async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT u.id, u.name, u.email, u.avatar, wm.role, wm.joined_at
            FROM workspace_members wm
            JOIN users u ON u.id = wm.user_id
            WHERE wm.workspace_id = ?
            ORDER BY wm.joined_at ASC`,
      args: [req.params.id]
    });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Создать инвайт (только owner/manager)
router.post('/:id/invites', requireAuth, requireRole(['owner', 'manager']), async (req, res) => {
  try {
    const { role = 'creator' } = req.body;
    const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

    await db.execute({
      sql: 'INSERT INTO invites (workspace_id, role, token) VALUES (?, ?, ?)',
      args: [req.params.id, role, token]
    });

    const inviteUrl = `${process.env.FRONTEND_URL}/invite/${token}`;
    res.status(201).json({ token, url: inviteUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Принять инвайт
router.post('/join/:token', requireAuth, async (req, res) => {
  try {
    const inviteResult = await db.execute({
      sql: 'SELECT * FROM invites WHERE token = ? AND used = 0',
      args: [req.params.token]
    });
    if (!inviteResult.rows.length) return res.status(404).json({ error: 'Инвайт не найден или уже использован' });

    const invite = inviteResult.rows[0];

    // Добавляем пользователя в воркспейс
    await db.execute({
      sql: 'INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)',
      args: [invite.workspace_id, req.user.id, invite.role]
    });

    // Помечаем инвайт как использованный
    await db.execute({ sql: 'UPDATE invites SET used = 1 WHERE id = ?', args: [invite.id] });

    res.json({ ok: true, workspace_id: invite.workspace_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Изменить роль члена (только owner)
router.put('/:id/members/:userId', requireAuth, requireRole(['owner']), async (req, res) => {
  try {
    const { role } = req.body;
    await db.execute({
      sql: 'UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?',
      args: [role, req.params.id, req.params.userId]
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Удалить члена (только owner)
router.delete('/:id/members/:userId', requireAuth, requireRole(['owner']), async (req, res) => {
  try {
    await db.execute({
      sql: 'DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      args: [req.params.id, req.params.userId]
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

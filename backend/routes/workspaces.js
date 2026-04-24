import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Создать воркспейс (онбординг) — автоматически план trial на 7 дней
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Введите название' });

    const slug = name.toLowerCase()
      .replace(/[^a-z0-9а-яё\s]/gi, '')
      .replace(/\s+/g, '-')
      .slice(0, 30) + '-' + Date.now().toString().slice(-4);

    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const result = await db.execute({
      sql: 'INSERT INTO workspaces (name, slug, owner_id, plan, trial_ends_at) VALUES (?, ?, ?, ?, ?)',
      args: [name, slug, req.user.id, 'trial', trialEndsAt]
    });
    const wsId = Number(result.lastInsertRowid);

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

// Получить все инвайты воркспейса (с информацией о присоединившихся)
router.get('/:id/invites', requireAuth, requireRole(['owner', 'manager']), async (req, res) => {
  try {
    const invitesResult = await db.execute({
      sql: `SELECT i.*,
              (SELECT COUNT(*) FROM workspace_members wm WHERE wm.invite_id = i.id) as joined_count
            FROM invites i
            WHERE i.workspace_id = ?
            ORDER BY i.created_at DESC`,
      args: [req.params.id]
    });

    const invites = await Promise.all(invitesResult.rows.map(async (inv) => {
      const joinersResult = await db.execute({
        sql: `SELECT u.name, u.email, wm.joined_at
              FROM workspace_members wm
              JOIN users u ON u.id = wm.user_id
              WHERE wm.workspace_id = ? AND wm.invite_id = ?
              ORDER BY wm.joined_at DESC`,
        args: [req.params.id, inv.id]
      });
      return {
        ...inv,
        url: `${process.env.FRONTEND_URL}/invite/${inv.token}`,
        joiners: joinersResult.rows,
        is_expired: inv.expires_at ? new Date(inv.expires_at) < new Date() : false,
      };
    }));

    res.json(invites);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Создать инвайт (многоразовый, как в Telegram)
router.post('/:id/invites', requireAuth, requireRole(['owner', 'manager']), async (req, res) => {
  try {
    const { role = 'creator', label, expires_days = 30 } = req.body;

    const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36);
    const expiresAt = new Date(Date.now() + parseInt(expires_days) * 24 * 60 * 60 * 1000).toISOString();

    const result = await db.execute({
      sql: 'INSERT INTO invites (workspace_id, role, token, label, expires_at) VALUES (?, ?, ?, ?, ?)',
      args: [req.params.id, role, token, label || null, expiresAt]
    });

    const inviteId = Number(result.lastInsertRowid);
    const inviteUrl = `${process.env.FRONTEND_URL}/invite/${token}`;
    res.status(201).json({ id: inviteId, token, url: inviteUrl, expires_at: expiresAt, role, label: label || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Удалить инвайт
router.delete('/:id/invites/:inviteId', requireAuth, requireRole(['owner', 'manager']), async (req, res) => {
  try {
    await db.execute({
      sql: 'DELETE FROM invites WHERE id = ? AND workspace_id = ?',
      args: [req.params.inviteId, req.params.id]
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Принять инвайт (многоразовый — не помечаем как использованный)
router.post('/join/:token', requireAuth, async (req, res) => {
  try {
    const inviteResult = await db.execute({
      sql: 'SELECT * FROM invites WHERE token = ?',
      args: [req.params.token]
    });
    if (!inviteResult.rows.length) return res.status(404).json({ error: 'Инвайт не найден' });

    const invite = inviteResult.rows[0];

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Ссылка-приглашение устарела' });
    }

    // Добавляем пользователя в воркспейс
    const existing = await db.execute({
      sql: 'SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      args: [invite.workspace_id, req.user.id]
    });

    if (!existing.rows.length) {
      await db.execute({
        sql: 'INSERT INTO workspace_members (workspace_id, user_id, role, invite_id) VALUES (?, ?, ?, ?)',
        args: [invite.workspace_id, req.user.id, invite.role, invite.id]
      });

      // Увеличиваем счётчик использований
      await db.execute({
        sql: 'UPDATE invites SET use_count = use_count + 1 WHERE id = ?',
        args: [invite.id]
      });
    }

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

import { Router } from 'express';
import passport from '../config/auth.js';
import { db } from '../db.js';

const router = Router();

// Начало входа через Google
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  prompt: 'select_account',
}));

// Callback после Google
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed` }),
  async (req, res) => {
    try {
      const user = req.user;

      const wsResult = await db.execute({
        sql: `SELECT w.* FROM workspaces w
              JOIN workspace_members wm ON wm.workspace_id = w.id
              WHERE wm.user_id = ? LIMIT 1`,
        args: [user.id]
      });

      if (wsResult.rows.length === 0) {
        res.redirect(`${process.env.FRONTEND_URL}/onboarding`);
      } else {
        res.redirect(`${process.env.FRONTEND_URL}/`);
      }
    } catch (err) {
      res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`);
    }
  }
);

// Текущий пользователь
router.get('/me', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    // Получаем воркспейс и роль
    const wsResult = await db.execute({
      sql: `SELECT w.*, wm.role FROM workspaces w
            JOIN workspace_members wm ON wm.workspace_id = w.id
            WHERE wm.user_id = ?`,
      args: [req.user.id]
    });

    res.json({
      user: req.user,
      workspaces: wsResult.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Обновление профиля
router.put('/me', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Имя не может быть пустым' });
  try {
    await db.execute({ sql: 'UPDATE users SET name = ? WHERE id = ?', args: [name.trim(), req.user.id] });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Выход
router.post('/logout', (req, res) => {
  req.logout(() => {
    res.json({ ok: true });
  });
});

export default router;

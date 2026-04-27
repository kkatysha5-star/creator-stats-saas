import { Router } from 'express';
import bcrypt from 'bcrypt';
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

// Регистрация по email
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'Заполните все поля' });
  if (password.length < 6) return res.status(400).json({ error: 'Пароль — минимум 6 символов' });

  try {
    const existing = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email.trim().toLowerCase()] });
    if (existing.rows.length) return res.status(409).json({ error: 'Email уже зарегистрирован' });

    const password_hash = await bcrypt.hash(password, 10);
    const result = await db.execute({
      sql: 'INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)',
      args: [email.trim().toLowerCase(), name.trim(), password_hash]
    });
    const userId = Number(result.lastInsertRowid);

    // Создаём воркспейс на trial 7 дней
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9а-яёa-z\s]/gi, '').replace(/\s+/g, '-').slice(0, 30) + '-' + Date.now().toString().slice(-4);
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const wsResult = await db.execute({
      sql: 'INSERT INTO workspaces (name, slug, owner_id, plan, trial_ends_at) VALUES (?, ?, ?, ?, ?)',
      args: [`КЗ ${name.trim()}`, slug, userId, 'trial', trialEndsAt]
    });
    const wsId = Number(wsResult.lastInsertRowid);
    await db.execute({
      sql: 'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)',
      args: [wsId, userId, 'owner']
    });

    const userRow = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [userId] });
    const user = userRow.rows[0];

    req.login(user, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Вход по email
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Заполните все поля' });

  try {
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email.trim().toLowerCase()] });
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Неверный email или пароль' });
    if (!user.password_hash) return res.status(401).json({ error: 'Этот аккаунт использует вход через Google' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Неверный email или пароль' });

    req.login(user, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    });
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

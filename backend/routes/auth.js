import { Router } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import { db } from '../db.js';
import { sendVerifyEmail, sendWelcome, sendPasswordReset } from '../email.js';

const router = Router();

// Текущий пользователь
router.get('/me', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  try {
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

    const password_hash = await bcrypt.hash(password, 8);
    const email_verify_token = randomUUID();

    const result = await db.execute({
      sql: 'INSERT INTO users (email, name, password_hash, email_verified, email_verify_token) VALUES (?, ?, ?, 0, ?)',
      args: [email.trim().toLowerCase(), name.trim(), password_hash, email_verify_token]
    });
    const userId = Number(result.lastInsertRowid);

    // Воркспейс trial 7 дней
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, '-').slice(0, 30) + '-' + Date.now().toString().slice(-4);
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

    // Присоединение к воркспейсу по инвайту (если есть)
    if (req.body.inviteToken) {
      try {
        const inviteResult = await db.execute({
          sql: 'SELECT * FROM invites WHERE token = ?',
          args: [req.body.inviteToken]
        });
        if (inviteResult.rows.length) {
          const invite = inviteResult.rows[0];
          const notExpired = !invite.expires_at || new Date(invite.expires_at) > new Date();
          if (notExpired) {
            await db.execute({
              sql: 'INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, invite_id) VALUES (?, ?, ?, ?)',
              args: [invite.workspace_id, userId, invite.role, invite.id]
            });
            await db.execute({
              sql: 'UPDATE invites SET use_count = use_count + 1 WHERE id = ?',
              args: [invite.id]
            });
            // Удаляем автоматически созданный воркспейс
            await db.execute({
              sql: 'DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
              args: [wsId, userId]
            });
            await db.execute({
              sql: 'DELETE FROM workspaces WHERE id = ? AND owner_id = ?',
              args: [wsId, userId]
            });
          }
        }
      } catch (e) { console.error('invite join error:', e.message); }
    }

    // Письма (не блокируем регистрацию если упадут)
    const verifyUrl = `https://app.cmetrika.com/verify-email?token=${email_verify_token}`;
    sendVerifyEmail(user, verifyUrl).catch(console.error);
    if (!req.body.inviteToken) {
      sendWelcome(user).catch(console.error);
    }

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
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Неверный email или пароль' });

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

// Повторная отправка письма подтверждения
router.post('/resend-verify', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.email_verified) return res.json({ ok: true });

  try {
    const token = randomUUID();
    await db.execute({ sql: 'UPDATE users SET email_verify_token = ? WHERE id = ?', args: [token, req.user.id] });
    const verifyUrl = `https://app.cmetrika.com/verify-email?token=${token}`;
    sendVerifyEmail(req.user, verifyUrl).catch(console.error);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Подтверждение почты
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Токен не указан' });

  try {
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE email_verify_token = ?', args: [token] });
    if (!result.rows.length) return res.status(400).json({ error: 'Недействительная ссылка' });

    await db.execute({
      sql: 'UPDATE users SET email_verified = 1, email_verify_token = NULL WHERE id = ?',
      args: [result.rows[0].id]
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Запрос сброса пароля
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Укажите email' });

  try {
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email.trim().toLowerCase()] });
    if (result.rows.length) {
      const user = result.rows[0];
      const token = randomUUID();
      const expires = Date.now() + 60 * 60 * 1000; // 1 час
      await db.execute({
        sql: 'UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?',
        args: [token, expires, user.id]
      });
      const resetUrl = `https://app.cmetrika.com/reset-password?token=${token}`;
      sendPasswordReset(user, resetUrl).catch(console.error);
    }
    // Всегда OK — не раскрываем есть ли такой email
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Сброс пароля
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Заполните все поля' });
  if (password.length < 8) return res.status(400).json({ error: 'Пароль — минимум 8 символов' });

  try {
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE reset_password_token = ?', args: [token] });
    if (!result.rows.length) return res.status(400).json({ error: 'Недействительная ссылка' });

    const user = result.rows[0];
    if (Number(user.reset_password_expires) < Date.now()) {
      return res.status(400).json({ error: 'Ссылка истекла. Запросите новую.' });
    }

    const password_hash = await bcrypt.hash(password, 8);
    await db.execute({
      sql: 'UPDATE users SET password_hash = ?, reset_password_token = NULL, reset_password_expires = NULL WHERE id = ?',
      args: [password_hash, user.id]
    });
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

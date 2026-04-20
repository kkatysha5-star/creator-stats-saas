import { db } from '../db.js';

// Проверяем что пользователь залогинен
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Необходима авторизация' });
  next();
}

// Проверяем роль в текущем воркспейсе
export function requireRole(roles) {
  return async (req, res, next) => {
    try {
      const wsId = req.params.id || req.body.workspace_id || req.query.workspace_id;
      if (!wsId) return res.status(400).json({ error: 'workspace_id required' });

      const result = await db.execute({
        sql: 'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
        args: [wsId, req.user.id]
      });

      if (!result.rows.length) return res.status(403).json({ error: 'Нет доступа к этому воркспейсу' });

      const role = result.rows[0].role;
      if (!roles.includes(role)) return res.status(403).json({ error: 'Недостаточно прав' });

      req.userRole = role;
      next();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
}

// Добавляем workspace_id и роль в каждый запрос
export async function attachWorkspace(req, res, next) {
  if (!req.user) return next();

  try {
    const wsId = req.headers['x-workspace-id'] || req.query.workspace_id;
    if (!wsId) return next();

    const result = await db.execute({
      sql: 'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      args: [wsId, req.user.id]
    });

    if (result.rows.length) {
      req.workspaceId = parseInt(wsId);
      req.userRole = result.rows[0].role;
    }
    next();
  } catch (err) {
    next();
  }
}

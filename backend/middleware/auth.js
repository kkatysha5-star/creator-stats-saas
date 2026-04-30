import { db } from '../db.js';

export const PLAN_LIMITS = {
  trial: { creators: 1,  funnel: false, label: 'Пробный' },
  start: { creators: 5,  funnel: false, label: 'Start' },
  pro:   { creators: 20, funnel: true,  label: 'Pro' },
  free:  { creators: 1,  funnel: false, label: 'Free' },
};

export function isPlanActive(workspace) {
  if (!workspace) return false;
  if (workspace.plan === 'trial') {
    if (!workspace.trial_ends_at) return false;
    return new Date(workspace.trial_ends_at) > new Date();
  }
  // paid plans — always active (no expiry logic yet)
  return true;
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Необходима авторизация' });
  next();
}

export function requireRole(roles) {
  return async (req, res, next) => {
    try {
      const wsId = req.workspaceId;
      if (!wsId) return res.status(400).json({ error: 'workspace_id required' });
      if (req.params.id && String(req.params.id) !== String(wsId)) {
        return res.status(403).json({ error: 'Нет доступа к этому воркспейсу' });
      }

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

// Модель доступа по ролям:
//   creator  — читает всю статистику команды; добавляет/редактирует ролики
//   manager  — всё что creator + управление воронкой
//   owner    — полный доступ, управление командой и тарифом
//
// Все GET-роуты (stats, posts, videos, creators) фильтруют только по workspace_id
// и не ограничивают по роли — creator видит данные всей команды.
// requireActivePlan применяется только к роутам записи (POST/PUT/DELETE).

// Блокирует запись если план истёк — только чтение
export function requireActivePlan(req, res, next) {
  if (!req.workspace) {
    // workspace не прикреплён — пропускаем без блокировки (нет контекста плана)
    return next();
  }
  if (!isPlanActive(req.workspace)) {
    return res.status(403).json({ error: 'trial_expired', message: 'Пробный период закончился. Данные доступны в режиме чтения.' });
  }
  next();
}

// Блокирует доступ к функциям недоступным на текущем плане
export function requirePlanFeature(feature) {
  return (req, res, next) => {
    const workspace = req.workspace;
    if (!workspace) return res.status(403).json({ error: 'Нет доступа' });
    const limits = PLAN_LIMITS[workspace.plan] || PLAN_LIMITS.trial;
    if (!limits[feature]) {
      return res.status(403).json({ error: 'plan_feature_unavailable', message: `Функция недоступна на плане ${limits.label}. Перейдите на Pro.` });
    }
    next();
  };
}

export async function attachWorkspace(req, res, next) {
  if (!req.user) return next();

  try {
    const wsId = req.headers['x-workspace-id'];
    if (!wsId) return next();

    const result = await db.execute({
      sql: `SELECT w.*, wm.role FROM workspaces w
            JOIN workspace_members wm ON wm.workspace_id = w.id
            WHERE w.id = ? AND wm.user_id = ?`,
      args: [wsId, req.user.id]
    });

    if (result.rows.length) {
      req.workspaceId = String(wsId);
      req.userRole = result.rows[0].role;
      req.workspace = result.rows[0];
    } else {
      return res.status(403).json({ error: 'Нет доступа к этому workspace' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

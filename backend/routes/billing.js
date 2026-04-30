import { Router } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  sendPaymentSuccess,
  sendPaymentNewUser,
  sendPaymentFailed,
} from '../email.js';

const router = Router();

function planLabel(planId) {
  return planId === 'start' ? 'Старт' : 'Про';
}
function planAmount(planId) {
  return planId === 'start' ? 1990 : 3990;
}
function nextBillingDate() {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}

function normalizePaymentMeta(value) {
  return value == null ? null : String(value);
}

function comparePendingField(metaValue, pendingValue) {
  return normalizePaymentMeta(metaValue) === normalizePaymentMeta(pendingValue);
}

// ─── POST /api/billing/create-payment ────────────────────────────────────────
router.post('/create-payment', async (req, res) => {
  const { email, fullName, planId, workspace_id, agreedToTerms } = req.body;
  if (!agreedToTerms) return res.status(400).json({ error: 'Необходимо принять условия оферты' });
  if (!email || !fullName || !planId) return res.status(400).json({ error: 'Заполните все поля' });
  if (!['start', 'pro'].includes(planId)) return res.status(400).json({ error: 'Неверный тариф' });

  try {
    const existing = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email.toLowerCase()] });
    const isExistingUser = existing.rows.length > 0;
    const workspaceKey = workspace_id ? String(workspace_id) : null;
    if (workspaceKey) {
      if (!req.user) return res.status(403).json({ error: 'Нет доступа к этому workspace' });

      const access = await db.execute({
        sql: `SELECT w.id, w.public_id FROM workspaces w
              LEFT JOIN workspace_members wm ON wm.workspace_id = w.id
              WHERE (w.id = ? OR w.public_id = ?) AND (w.owner_id = ? OR wm.user_id = ?)
              LIMIT 1`,
        args: [workspaceKey, workspaceKey, req.user.id, req.user.id],
      });
      if (!access.rows.length) return res.status(403).json({ error: 'Нет доступа к этому workspace' });
    }

    const metadata = { email, fullName, planId, isExistingUser: String(isExistingUser) };
    if (workspaceKey) {
      const workspace = await db.execute({
        sql: 'SELECT id, public_id FROM workspaces WHERE id = ? OR public_id = ? LIMIT 1',
        args: [workspaceKey, workspaceKey],
      });
      if (!workspace.rows.length) return res.status(404).json({ error: 'Workspace not found' });
      metadata.workspace_id = workspace.rows[0].public_id || String(workspace.rows[0].id);
    }

    const { default: YooKassa } = await import('yookassa');
    const checkout = new YooKassa({
      shopId: process.env.YOOKASSA_SHOP_ID,
      secretKey: process.env.YOOKASSA_SECRET_KEY,
    });

    const payment = await checkout.createPayment({
      amount: { value: String(planAmount(planId)) + '.00', currency: 'RUB' },
      capture: true,
      save_payment_method: true,
      confirmation: {
        type: 'redirect',
        return_url: 'https://app.cmetrika.com/checkout?status=success',
      },
      metadata,
      description: `КонтентМетрика — тариф ${planLabel(planId)}`,
    }, randomUUID());

    await db.execute({
      sql: `INSERT INTO pending_payments (payment_id, email, full_name, plan_id, workspace_id, is_existing_user, created_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      args: [payment.id, email.toLowerCase(), fullName, planId, metadata.workspace_id || null, isExistingUser ? 1 : 0],
    });

    res.json({ confirmationUrl: payment.confirmation.confirmation_url });
  } catch (e) {
    console.error('[billing] create-payment error:', e.message);
    res.status(500).json({ error: 'Ошибка создания платежа. Попробуйте ещё раз.' });
  }
});

// ─── POST /api/billing/webhook (экспортируется отдельно для подключения до session) ──
export async function billingWebhook(req, res) {
  try {
    const { event, object: payment } = req.body;
    if (event !== 'payment.succeeded' || payment.status !== 'succeeded' || payment.paid !== true) {
      return res.json({ ok: true });
    }
    if (!payment?.id) {
      return res.json({ ok: true });
    }

    const alreadyProcessed = await db.execute({
      sql: 'SELECT payment_id FROM processed_payments WHERE payment_id = ?',
      args: [payment.id],
    });
    if (alreadyProcessed.rows.length) {
      return res.json({ ok: true });
    }

    const { email, fullName, planId, workspace_id, isExistingUser } = payment.metadata || {};
    if (!email || !planId) {
      return res.json({ ok: true });
    }

    const pendingResult = await db.execute({
      sql: `SELECT payment_id, email, full_name, plan_id, workspace_id, is_existing_user
            FROM pending_payments
            WHERE payment_id = ?`,
      args: [payment.id],
    });
    const pending = pendingResult.rows[0];
    if (!pending) {
      console.error('[billing] webhook: pending payment not found', payment.id);
      return res.json({ ok: true });
    }

    const mismatchReasons = [];
    if (!comparePendingField(email.toLowerCase(), pending.email)) mismatchReasons.push('email');
    if (!comparePendingField(planId, pending.plan_id)) mismatchReasons.push('plan_id');
    if (pending.is_existing_user != null && !comparePendingField(isExistingUser, pending.is_existing_user)) mismatchReasons.push('is_existing_user');
    if (pending.workspace_id != null && !comparePendingField(workspace_id, pending.workspace_id)) mismatchReasons.push('workspace_id');

    if (mismatchReasons.length) {
      console.error('[billing] webhook: pending payment mismatch', payment.id, mismatchReasons.join(', '));
      return res.json({ ok: true });
    }

    const paymentMethodId = payment.payment_method?.id;
    const nbDate = nextBillingDate();
    const amount = planAmount(planId);
    const pName = planLabel(planId);
    let paymentSuccessEmail = null;
    let paymentSuccessName = null;
    let paymentNewUserEmail = null;
    let newUserResetUrl = null;

    await db.execute('BEGIN');
    try {
      await db.execute({
        sql: 'INSERT OR IGNORE INTO processed_payments (payment_id) VALUES (?)',
        args: [payment.id],
      });
      const insertedCheck = await db.execute('SELECT changes() AS changes');
      if (!insertedCheck.rows[0] || Number(insertedCheck.rows[0].changes) === 0) {
        await db.execute('ROLLBACK');
        return res.json({ ok: true });
      }

      if (isExistingUser === 'false') {
        // Новый пользователь — создаём аккаунт и воркспейс
        let userRow = (await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email.toLowerCase()] })).rows[0];

        if (!userRow) {
          const hash = await bcrypt.hash(randomUUID(), 8);
          const r = await db.execute({
            sql: `INSERT INTO users (email, name, password_hash, email_verified)
                  VALUES (?, ?, ?, 1)`,
            args: [email.toLowerCase(), fullName, hash],
          });
          userRow = { id: Number(r.lastInsertRowid) };
        }

        const publicId = randomUUID();
        const wsResult = await db.execute({
          sql: `INSERT INTO workspaces (name, slug, owner_id, plan, subscription_active, payment_method_id, next_billing_date, public_id)
                VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
          args: [`${fullName} workspace`, `ws-${randomUUID().slice(0, 8)}`, userRow.id, planId, paymentMethodId || null, nbDate, publicId],
        });
        const wsId = Number(wsResult.lastInsertRowid);

        // Добавляем owner в workspace_members
        await db.execute({
          sql: `INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')`,
          args: [wsId, userRow.id],
        });

        const resetToken = randomUUID();
        const resetExpires = Date.now() + 24 * 60 * 60 * 1000;
        await db.execute({
          sql: `UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?`,
          args: [resetToken, resetExpires, userRow.id],
        });

        paymentNewUserEmail = email;
        newUserResetUrl = `https://app.cmetrika.com/reset-password?token=${resetToken}`;
      } else {
        // Существующий пользователь — обновляем воркспейс
        const user = (await db.execute({ sql: 'SELECT id, name, email FROM users WHERE email = ?', args: [email.toLowerCase()] })).rows[0];
        if (!user) {
          await db.execute('ROLLBACK');
          return;
        }

        if (workspace_id) {
          const workspace = await db.execute({
            sql: 'SELECT id, public_id FROM workspaces WHERE public_id = ? OR id = ?',
            args: [workspace_id, workspace_id],
          });
          if (!workspace.rows.length) {
            console.error('[billing] webhook: workspace not found');
            await db.execute('ROLLBACK');
            return res.json({ ok: true });
          }

          await db.execute({
            sql: `UPDATE workspaces SET plan = ?, subscription_active = 1, payment_method_id = ?, next_billing_date = ? WHERE id = ?`,
            args: [planId, paymentMethodId || null, nbDate, workspace.rows[0].id],
          });
        } else {
          const wsRow = await db.execute({
            sql: `SELECT w.id FROM workspaces w
                  WHERE w.owner_id = ?
                  LIMIT 1`,
            args: [user.id],
          });

          if (wsRow.rows.length > 0) {
            const wsId = wsRow.rows[0].id;
            await db.execute({
              sql: `UPDATE workspaces SET plan = ?, subscription_active = 1, payment_method_id = ?, next_billing_date = ? WHERE id = ?`,
              args: [planId, paymentMethodId || null, nbDate, wsId],
            });
          } else {
            const publicId = randomUUID();
            const wsResult = await db.execute({
              sql: `INSERT INTO workspaces (name, slug, owner_id, plan, subscription_active, payment_method_id, next_billing_date, public_id)
                    VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
              args: [`${user.name || fullName} workspace`, `ws-${randomUUID().slice(0, 8)}`, user.id, planId, paymentMethodId || null, nbDate, publicId],
            });
            const wsId = Number(wsResult.lastInsertRowid);
            await db.execute({
              sql: `INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')`,
              args: [wsId, user.id],
            });
          }
        }

        paymentSuccessEmail = user.email;
        paymentSuccessName = user.name || fullName;
      }

      await db.execute({ sql: 'DELETE FROM pending_payments WHERE payment_id = ?', args: [payment.id] }).catch(() => {});
      await db.execute('COMMIT');
    } catch (dbErr) {
      await db.execute('ROLLBACK').catch(() => {});
      throw dbErr;
    }

    if (paymentNewUserEmail && newUserResetUrl) {
      await sendPaymentNewUser(paymentNewUserEmail, fullName, pName, newUserResetUrl).catch(console.error);
    }
    if (paymentSuccessEmail) {
      await sendPaymentSuccess(
        { name: paymentSuccessName || fullName, email: paymentSuccessEmail },
        { planName: pName, amount, nextDate: nbDate }
      ).catch(console.error);
    }

    return res.json({ ok: true });

  } catch (e) {
    console.error('[billing] webhook error:', e.message);
    if (!res.headersSent) {
      return res.status(200).json({ ok: true });
    }
  }
}

// ─── POST /api/billing/charge-subscription ───────────────────────────────────
router.post('/charge-subscription', async (req, res) => {
  if (req.headers['x-internal-token'] !== process.env.SESSION_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await db.execute({
      sql: `SELECT w.id, w.plan, w.payment_method_id, w.owner_id
            FROM workspaces w
            WHERE w.subscription_active = 1 AND w.next_billing_date <= ?`,
      args: [today],
    });

    const { default: YooKassa } = await import('yookassa');
    const checkout = new YooKassa({
      shopId: process.env.YOOKASSA_SHOP_ID,
      secretKey: process.env.YOOKASSA_SECRET_KEY,
    });

    let charged = 0, failed = 0;
    for (const ws of result.rows) {
      try {
        const amount = planAmount(ws.plan);
        await checkout.createPayment({
          amount: { value: `${amount}.00`, currency: 'RUB' },
          capture: true,
          payment_method_id: ws.payment_method_id,
          description: `КонтентМетрика — тариф ${planLabel(ws.plan)} (автосписание)`,
        }, randomUUID());

        const nbDate = nextBillingDate();
        await db.execute({
          sql: 'UPDATE workspaces SET next_billing_date = ? WHERE id = ?',
          args: [nbDate, ws.id],
        });
        charged++;
      } catch (e) {
        console.error(`[billing] auto-charge failed for ws ${ws.id}:`, e.message);
        await db.execute({
          sql: 'UPDATE workspaces SET subscription_active = 0 WHERE id = ?',
          args: [ws.id],
        });
        const owner = await db.execute({ sql: 'SELECT name, email FROM users WHERE id = ?', args: [ws.owner_id] });
        if (owner.rows[0]) {
          await sendPaymentFailed(owner.rows[0], { planName: planLabel(ws.plan), amount: planAmount(ws.plan) }).catch(console.error);
        }
        failed++;
      }
    }

    res.json({ charged, failed });
  } catch (e) {
    console.error('[billing] charge-subscription error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/billing/cancel ────────────────────────────────────────────────
router.post('/cancel', requireAuth, requireRole(['owner']), async (req, res) => {
  try {
    await db.execute({
      sql: 'UPDATE workspaces SET subscription_active = 0 WHERE id = ?',
      args: [req.workspaceId],
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/billing/status ─────────────────────────────────────────────────
router.get('/status', requireAuth, async (req, res) => {
  try {
    if (!req.workspaceId) return res.status(400).json({ error: 'workspace_id required' });
    if (req.userRole !== 'owner') return res.status(403).json({ error: 'Недостаточно прав' });

    const result = await db.execute({
      sql: 'SELECT plan, subscription_active, next_billing_date FROM workspaces WHERE id = ?',
      args: [req.workspaceId],
    });
    if (!result.rows[0]) return res.status(404).json({ error: 'Workspace not found' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

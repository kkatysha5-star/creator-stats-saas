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

// ─── POST /api/billing/create-payment ────────────────────────────────────────
router.post('/create-payment', async (req, res) => {
  const { email, fullName, planId, agreedToTerms } = req.body;
  if (!agreedToTerms) return res.status(400).json({ error: 'Необходимо принять условия оферты' });
  if (!email || !fullName || !planId) return res.status(400).json({ error: 'Заполните все поля' });
  if (!['start', 'pro'].includes(planId)) return res.status(400).json({ error: 'Неверный тариф' });

  try {
    const existing = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email.toLowerCase()] });
    const isExistingUser = existing.rows.length > 0;

    const { YooCheckout } = await import('yookassa');
    const checkout = new YooCheckout({
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
      metadata: { email, fullName, planId, isExistingUser: String(isExistingUser) },
      description: `КонтентМетрика — тариф ${planLabel(planId)}`,
    }, randomUUID());

    await db.execute({
      sql: `INSERT INTO pending_payments (payment_id, email, full_name, plan_id, is_existing_user, created_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      args: [payment.id, email.toLowerCase(), fullName, planId, isExistingUser ? 1 : 0],
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
    res.json({ ok: true }); // ЮКасса ждёт 200 немедленно

    if (event !== 'payment.succeeded') return;

    const { email, fullName, planId, isExistingUser } = payment.metadata || {};
    if (!email || !planId) return;

    const paymentMethodId = payment.payment_method?.id;
    const nbDate = nextBillingDate();
    const amount = planAmount(planId);
    const pName = planLabel(planId);

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

      const wsResult = await db.execute({
        sql: `INSERT INTO workspaces (name, slug, owner_id, plan, subscription_active, payment_method_id, next_billing_date)
              VALUES (?, ?, ?, ?, 1, ?, ?)`,
        args: [`${fullName} workspace`, `ws-${randomUUID().slice(0, 8)}`, userRow.id, planId, paymentMethodId || null, nbDate],
      });

      // Добавляем owner в workspace_members
      await db.execute({
        sql: `INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')`,
        args: [Number(wsResult.lastInsertRowid), userRow.id],
      });

      const resetToken = randomUUID();
      const resetExpires = Date.now() + 24 * 60 * 60 * 1000;
      await db.execute({
        sql: `UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?`,
        args: [resetToken, resetExpires, userRow.id],
      });

      const resetUrl = `https://app.cmetrika.com/reset-password?token=${resetToken}`;
      await sendPaymentNewUser(email, fullName, pName, resetUrl).catch(console.error);

    } else {
      // Существующий пользователь — обновляем воркспейс
      const wsRow = await db.execute({
        sql: `SELECT w.id FROM workspaces w
              JOIN users u ON u.id = w.owner_id
              WHERE u.email = ?
              LIMIT 1`,
        args: [email.toLowerCase()],
      });

      if (wsRow.rows.length > 0) {
        const wsId = wsRow.rows[0].id;
        await db.execute({
          sql: `UPDATE workspaces SET plan = ?, subscription_active = 1, payment_method_id = ?, next_billing_date = ? WHERE id = ?`,
          args: [planId, paymentMethodId || null, nbDate, wsId],
        });
      }

      const user = (await db.execute({ sql: 'SELECT name, email FROM users WHERE email = ?', args: [email.toLowerCase()] })).rows[0];
      if (user) {
        await sendPaymentSuccess(
          { name: user.name, email: user.email },
          { planName: pName, amount, nextDate: nbDate }
        ).catch(console.error);
      }
    }

    // Очищаем pending
    await db.execute({ sql: 'DELETE FROM pending_payments WHERE payment_id = ?', args: [payment.id] }).catch(() => {});

  } catch (e) {
    console.error('[billing] webhook error:', e.message);
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

    const { YooCheckout } = await import('yookassa');
    const checkout = new YooCheckout({
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

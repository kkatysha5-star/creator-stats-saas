import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../App.jsx';
import { Btn, Modal, Loader } from '../components/UI.jsx';
import { fmtDate } from '../lib/utils.js';

const PLANS = [
  {
    id: 'start',
    name: 'Start',
    price: '1 990 ₽/мес',
    features: ['До 5 креаторов', 'YouTube, TikTok, Instagram', 'Автообновление статистики'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '3 990 ₽/мес',
    features: ['До 20 креаторов', 'Воронка продаж + CAC', 'YouTube, TikTok, Instagram'],
    accent: true,
  },
];

export default function Billing() {
  const { auth } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(null); // planId
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => {
    api.getBillingStatus().then(setStatus).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleCancelConfirm = async () => {
    await api.cancelSubscription();
    setShowCancel(false);
    setStatus(s => ({ ...s, subscription_active: 0 }));
  };

  if (loading) return <Loader />;

  const isActive = status?.subscription_active === 1 || status?.subscription_active === 1n;

  return (
    <div style={{ padding: '0 0 48px' }}>
      <div style={{ padding: '24px 28px 20px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: -0.4 }}>Биллинг</h1>
        <p style={{ fontSize: 13, color: 'var(--text3)', margin: '4px 0 0' }}>Управление подпиской</p>
      </div>

      {isActive ? (
        <ActiveView status={status} onCancel={() => setShowCancel(true)} />
      ) : (
        <PlansView onSubscribe={(planId) => setShowModal(planId)} />
      )}

      {showModal && (
        <SubscribeModal
          planId={showModal}
          email={auth?.user?.email || ''}
          workspaceId={auth?.workspaces?.[0]?.id}
          onClose={() => setShowModal(null)}
        />
      )}

      {showCancel && (
        <Modal
          title="Отменить подписку"
          onClose={() => setShowCancel(false)}
          footer={
            <>
              <Btn onClick={() => setShowCancel(false)}>Оставить</Btn>
              <Btn variant="primary" onClick={handleCancelConfirm} style={{ background: '#ef4444' }}>
                Отменить подписку
              </Btn>
            </>
          }
        >
          <p style={{ fontSize: 14, color: 'var(--text2)', margin: 0, lineHeight: 1.6 }}>
            Вы уверены? Подписка будет активна до <strong style={{ fontWeight: 700 }}>{fmtDate(status?.next_billing_date)}</strong>, после чего доступ будет ограничен.
          </p>
        </Modal>
      )}
    </div>
  );
}

function ActiveView({ status, onCancel }) {
  const planName = status?.plan === 'start' ? 'Start' : 'Pro';
  const amount = status?.plan === 'start' ? '1 990' : '3 990';

  return (
    <div style={{ padding: '0 28px' }}>
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--card-border)',
        borderTop: '1px solid var(--card-border-top)',
        borderRadius: 'var(--radius)', padding: '24px 28px', maxWidth: 480,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Подписка активна</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          <Row label="Тариф" value={planName} />
          <Row label="Сумма" value={`${amount} ₽/мес`} />
          <Row label="Следующее списание" value={<strong style={{ fontWeight: 700 }}>{fmtDate(status?.next_billing_date)}</strong>} />
        </div>
        <Btn onClick={onCancel} style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
          Отменить подписку
        </Btn>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
      <span style={{ color: 'var(--text3)' }}>{label}</span>
      <span style={{ color: 'var(--text)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function PlansView({ onSubscribe }) {
  return (
    <div style={{ padding: '0 28px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, maxWidth: 560 }}>
        {PLANS.map(p => (
          <div key={p.id} style={{
            background: 'var(--card-bg)', border: `1px solid ${p.accent ? 'var(--accent)' : 'var(--card-border)'}`,
            borderTop: `1px solid ${p.accent ? 'rgba(255,106,0,0.4)' : 'var(--card-border-top)'}`,
            borderRadius: 'var(--radius)', padding: '22px 20px',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: p.accent ? 'var(--accent)' : 'var(--text)', marginBottom: 4 }}>{p.name}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 12, letterSpacing: -0.5 }}>{p.price}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
              {p.features.map(f => (
                <div key={f} style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {f}
                </div>
              ))}
            </div>
            <Btn variant={p.accent ? 'primary' : 'ghost'} onClick={() => onSubscribe(p.id)} style={{ width: '100%', justifyContent: 'center' }}>
              Подключить
            </Btn>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubscribeModal({ planId, email, workspaceId, onClose }) {
  const planLabel = planId === 'start' ? 'Start' : 'Pro';
  const [fullName, setFullName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePay = async () => {
    if (!fullName.trim() || !agreed) return;
    setLoading(true); setError('');
    try {
      const res = await api.createPayment({ email, fullName: fullName.trim(), planId, workspace_id: workspaceId, agreedToTerms: true });
      window.location.href = res.confirmationUrl;
    } catch (e) {
      setError(e.message || 'Ошибка. Попробуйте ещё раз.');
      setLoading(false);
    }
  };

  return (
    <Modal
      title={`Подключить тариф ${planLabel}`}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Отмена</Btn>
          <Btn variant="primary" loading={loading} onClick={handlePay} disabled={!fullName.trim() || !agreed}>
            Перейти к оплате →
          </Btn>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>Email</label>
        <input
          readOnly value={email}
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text3)', fontSize: 13, fontFamily: 'var(--font)', cursor: 'default' }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>ФИО</label>
        <input
          value={fullName} onChange={e => setFullName(e.target.value)}
          placeholder="Иванов Иван Иванович"
          style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font)', outline: 'none' }}
        />
      </div>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
        <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: 2, accentColor: '#ff6a00', flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
          Я ознакомился и согласен с{' '}
          <a href="#" style={{ color: 'var(--accent)', textDecoration: 'none' }}>офертой</a>
          {' '}и{' '}
          <a href="#" style={{ color: 'var(--accent)', textDecoration: 'none' }}>политикой конфиденциальности</a>
        </span>
      </label>
      {error && <p style={{ color: '#ff5050', fontSize: 12, margin: 0 }}>{error}</p>}
    </Modal>
  );
}

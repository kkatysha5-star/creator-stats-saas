import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { fmtDate } from '../lib/utils.js';

const PLANS = [
  {
    id: 'start',
    name: 'Start',
    price: '1 990 ₽',
    period: '/мес',
    features: ['До 5 креаторов', 'YouTube, TikTok, Instagram', 'Автообновление статистики'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '3 990 ₽',
    period: '/мес',
    features: ['До 20 креаторов', 'Воронка продаж + CAC', 'YouTube, TikTok, Instagram'],
    accent: true,
  },
];

const spinnerStyle = {
  width: 18, height: 18,
  border: '2px solid rgba(255,106,0,0.2)',
  borderTopColor: '#ff6a00',
  borderRadius: '50%',
  animation: 'spin 0.7s linear infinite',
  display: 'inline-block',
  flexShrink: 0,
};

export default function Checkout() {
  const params = new URLSearchParams(window.location.search);
  const isSuccess = params.get('status') === 'success';

  if (isSuccess) return <SuccessScreen />;
  return <CheckoutForm />;
}

function SuccessScreen() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [billingStatus, setBillingStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;

    api.getMe()
      .then(async () => {
        if (cancelled) return;
        setIsAuthed(true);
        try {
          const status = await api.getBillingStatus();
          if (!cancelled) setBillingStatus(status);
        } catch {}
      })
      .catch(() => {
        if (!cancelled) setIsAuthed(false);
      })
      .finally(() => {
        if (!cancelled) setAuthChecked(true);
      });

    return () => { cancelled = true; };
  }, []);

  const subscriptionDate = fmtDate(billingStatus?.next_billing_date);
  const successText = billingStatus?.next_billing_date
    ? <>Подписка активна до <strong style={{ color: '#fff', fontWeight: 700 }}>{subscriptionDate}</strong></>
    : 'Оплата прошла успешно. Подписка активируется...';

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(74,222,128,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-5" />
          </svg>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#fff', margin: '0 0 12px', letterSpacing: -0.5 }}>Оплата прошла!</h1>
        {isAuthed ? (
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.6 }}>
            {successText}
          </p>
        ) : authChecked ? (
          <>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', margin: '0 0 28px', lineHeight: 1.6 }}>
              Проверьте почту — мы отправили письмо с инструкцией для входа в аккаунт.
            </p>
            <a href="/login" style={btnStyle}>Войти в аккаунт →</a>
          </>
        ) : null}
      </div>
    </div>
  );
}

function CheckoutForm() {
  const [planId, setPlanId] = useState('pro');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  const canSubmit = email.trim() && fullName.trim() && agreed && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const res = await fetch('/api/billing/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), fullName: fullName.trim(), planId, agreedToTerms: true }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Ошибка. Попробуйте ещё раз.'); return; }
      window.location.href = data.confirmationUrl;
    } catch {
      showToast('Ошибка соединения. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={{ ...cardStyle, maxWidth: 520 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{ width: 36, height: 36, background: '#ff6a00', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#fff', flexShrink: 0 }}>КМ</div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: -0.3 }}>КонтентМетрика</span>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 20px', letterSpacing: -0.4 }}>Подключить КонтентМетрику</h1>

        {/* Plan cards */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {PLANS.map(p => (
            <div
              key={p.id}
              onClick={() => setPlanId(p.id)}
              style={{
                flex: 1, padding: '16px 14px', borderRadius: 14, cursor: 'pointer', transition: 'all 180ms',
                background: 'rgba(255,255,255,0.04)',
                border: planId === p.id ? '1.5px solid #ff6a00' : '0.5px solid rgba(255,255,255,0.08)',
                boxShadow: planId === p.id ? '0 0 0 3px rgba(255,106,0,0.1)' : 'none',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: p.accent ? '#ff6a00' : 'rgba(255,255,255,0.8)', marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>
                {p.price}<span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>{p.period}</span>
              </div>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {p.features.map(f => (
                  <div key={f} style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    {f}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
          <Field label="ФИО" value={fullName} onChange={setFullName} placeholder="Иванов Иван Иванович" />
        </div>

        {/* Agree */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 20 }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            style={{ marginTop: 2, accentColor: '#ff6a00', flexShrink: 0 }}
          />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
            Я ознакомился и согласен с{' '}
            <a href="#" style={{ color: '#ff6a00', textDecoration: 'none' }}>офертой</a>
            {' '}и{' '}
            <a href="#" style={{ color: '#ff6a00', textDecoration: 'none' }}>политикой конфиденциальности</a>
          </span>
        </label>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            ...btnStyle,
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: canSubmit ? 1 : 0.45, cursor: canSubmit ? 'pointer' : 'not-allowed',
            border: 'none', fontSize: 15,
          }}
        >
          {loading ? <span style={spinnerStyle} /> : 'Перейти к оплате →'}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 100, padding: '9px 18px', fontSize: 13, color: '#fff',
          zIndex: 9999, whiteSpace: 'nowrap', pointerEvents: 'none',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)', animation: 'fadeUp 150ms ease-out both',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 5, fontWeight: 500 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.12)',
          borderRadius: 10, padding: '10px 13px', color: '#fff', fontSize: 14,
          fontFamily: 'Urbanist, sans-serif', outline: 'none',
        }}
      />
    </div>
  );
}

const pageStyle = {
  minHeight: '100vh',
  background: '#080808',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px 16px',
  fontFamily: 'Urbanist, sans-serif',
};

const cardStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '0.5px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(20px)',
  borderRadius: 20,
  padding: '36px 32px',
  width: '100%',
  maxWidth: 480,
  textAlign: 'center',
};

const btnStyle = {
  background: '#ff6a00',
  color: '#fff',
  borderRadius: 100,
  padding: '13px 28px',
  fontFamily: 'Urbanist, sans-serif',
  fontWeight: 700,
  fontSize: 15,
  textDecoration: 'none',
  cursor: 'pointer',
  display: 'inline-block',
  transition: 'opacity 150ms',
};

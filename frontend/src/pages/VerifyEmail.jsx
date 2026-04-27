import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function VerifyEmail() {
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) { setStatus('error'); setError('Токен не найден'); return; }

    api.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(e => { setStatus('error'); setError(e.message); });
  }, []);

  const card = {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg)', fontFamily: 'var(--font)',
  };
  const box = {
    background: 'var(--card-bg)', border: '1px solid var(--card-border)',
    borderTop: '1px solid var(--card-border-top)', borderRadius: 'var(--radius-lg)',
    padding: '52px 44px', maxWidth: 420, width: '100%', textAlign: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
  };

  return (
    <div style={card}>
      <div style={box}>
        <div style={{ background: '#ff6a00', borderRadius: 10, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16 }}>КМ</div>

        {status === 'loading' && (
          <>
            <div style={{ width: 22, height: 22, border: '2px solid rgba(255,255,255,0.1)', borderTop: '2px solid #ff6a00', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
            <p style={{ color: 'var(--text2)', fontSize: 14, margin: 0 }}>Подтверждаем почту…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: 44 }}>✅</div>
            <h2 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 700, margin: 0 }}>Почта подтверждена!</h2>
            <p style={{ color: 'var(--text2)', fontSize: 14, margin: 0 }}>Теперь у вас есть полный доступ к КонтентМетрике.</p>
            <button
              onClick={() => navigate('/')}
              style={{ background: '#ff6a00', border: 'none', borderRadius: 100, color: '#fff', fontFamily: 'var(--font)', fontSize: 14, fontWeight: 600, padding: '11px 28px', cursor: 'pointer', marginTop: 4 }}
            >
              Перейти в сервис →
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: 44 }}>❌</div>
            <h2 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 700, margin: 0 }}>Ошибка</h2>
            <p style={{ color: 'var(--text2)', fontSize: 14, margin: 0 }}>{error || 'Недействительная или устаревшая ссылка'}</p>
            <button
              onClick={() => navigate('/')}
              style={{ background: 'transparent', border: '1px solid var(--border2)', borderRadius: 100, color: 'var(--text2)', fontFamily: 'var(--font)', fontSize: 14, padding: '10px 24px', cursor: 'pointer', marginTop: 4 }}
            >
              На главную
            </button>
          </>
        )}
      </div>
    </div>
  );
}

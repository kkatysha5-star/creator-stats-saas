import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function VerifyEmail() {
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) { setStatus('error'); setError('Токен не найден'); return; }
    api.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(e => { setStatus('error'); setError(e.message); });
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', fontFamily: 'var(--font)' }}>
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--card-border)',
        borderTop: '1px solid var(--card-border-top)', borderRadius: 'var(--radius-lg)',
        padding: '52px 44px', maxWidth: 420, width: '100%', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
      }}>
        {/* Логотип */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 8 }}>
          <div style={{ background: '#ff6a00', borderRadius: 10, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 16 }}>КМ</div>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>КонтентМетрика</span>
        </div>

        {status === 'loading' && (
          <>
            <div style={{ width: 22, height: 22, border: '2px solid rgba(128,128,128,0.2)', borderTop: '2px solid #ff6a00', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
            <p style={{ color: 'var(--text2)', fontSize: 14, margin: 0 }}>Подтверждаем почту…</p>
          </>
        )}

        {status === 'success' && (
          <>
            {/* Оранжевый круг с белой галочкой */}
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="32" fill="#ff6a00" />
              <path d="M19 32l10 10 16-20" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
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
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="32" fill="rgba(239,68,68,0.15)" />
              <path d="M22 22l20 20M42 22L22 42" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" />
            </svg>
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

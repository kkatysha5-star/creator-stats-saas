import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../lib/api.js';
import { finishAuth } from '../lib/authFlow.js';
import styles from './Login.module.css';

export default function Login() {
  const [tab, setTab] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  const resetSuccess = new URLSearchParams(window.location.search).get('reset') === 'success';

  const handleForgot = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      await api.forgotPassword(forgotEmail);
      setForgotSent(true);
    } catch {
      setForgotSent(true); // не раскрываем ошибку
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const pendingInviteToken = localStorage.getItem('pendingInviteToken') || undefined;
      let registeredWorkspaceId = null;
      if (tab === 'register') {
        const registered = await api.register({ name, email, password, inviteToken: pendingInviteToken });
        registeredWorkspaceId = registered?.workspace_id;
        if (pendingInviteToken) localStorage.removeItem('pendingInviteToken');
      } else {
        await api.emailLogin({ email, password });
      }
      await finishAuth(setAuth, navigate, tab === 'login' ? pendingInviteToken : null, registeredWorkspaceId);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Лого */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 4 }}>
          <div style={{ background: '#ff6a00', borderRadius: '10px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '16px' }}>КМ</div>
          <span style={{ color: 'var(--text)', fontSize: '20px', fontWeight: 700 }}>КонтентМетрика</span>
        </div>

        {resetSuccess && (
          <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, color: 'var(--color-ok)', width: '100%', textAlign: 'left' }}>
            ✓ Пароль изменён — войдите с новым паролем
          </div>
        )}

        {/* Режим «Забыли пароль?» */}
        {forgotMode ? (
          forgotSent ? (
            <>
              <div style={{ fontSize: 36 }}>📬</div>
              <p style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, margin: 0 }}>Письмо отправлено</p>
              <p style={{ color: 'var(--text2)', fontSize: 13, margin: 0, textAlign: 'center' }}>
                Если этот email зарегистрирован, письмо уже в пути. Проверьте папку «Спам».
              </p>
              <button className={styles.skipLink} onClick={() => { setForgotMode(false); setForgotSent(false); }}>
                ← Вернуться ко входу
              </button>
            </>
          ) : (
            <>
              <p style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600, margin: 0 }}>Сброс пароля</p>
              <form className={styles.form} onSubmit={handleForgot}>
                <div className={styles.field}>
                  <label className={styles.label}>Email</label>
                  <input className={styles.input} type="email" placeholder="you@example.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required autoFocus />
                </div>
                <button className={styles.submitBtn} type="submit" disabled={forgotLoading}>
                  {forgotLoading ? <span className={styles.btnSpinner} /> : 'Отправить ссылку'}
                </button>
              </form>
              <button className={styles.skipLink} onClick={() => setForgotMode(false)}>← Вернуться ко входу</button>
            </>
          )
        ) : (
        <>
        {/* Табы */}
        <div className={styles.tabs}>
          <button className={[styles.tab, tab === 'login' ? styles.tabActive : ''].join(' ')} onClick={() => { setTab('login'); setError(''); }}>
            Войти
          </button>
          <button className={[styles.tab, tab === 'register' ? styles.tabActive : ''].join(' ')} onClick={() => { setTab('register'); setError(''); }}>
            Регистрация
          </button>
        </div>

        {/* Форма */}
        <form className={styles.form} onSubmit={handleSubmit}>
          {tab === 'register' && (
            <div className={styles.field}>
              <label className={styles.label}>Имя</label>
              <input
                className={styles.input}
                type="text"
                placeholder="Ваше имя"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
          )}
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Пароль</label>
            <input
              className={styles.input}
              type="password"
              placeholder={tab === 'register' ? 'Минимум 6 символов' : '••••••••'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.submitBtn} type="submit" disabled={loading}>
            {loading ? <span className={styles.btnSpinner} /> : (tab === 'register' ? 'Создать аккаунт' : 'Войти')}
          </button>
          {loading && tab === 'register' && (
            <p style={{ color: 'var(--text3)', fontSize: 12, margin: 0, textAlign: 'center' }}>
              Создаём аккаунт, это займёт пару секунд…
            </p>
          )}
        </form>

        {tab === 'login' && (
          <button className={styles.skipLink} onClick={() => { setForgotMode(true); setForgotEmail(email); }}>
            Забыли пароль?
          </button>
        )}
        </>
        )}
      </div>
    </div>
  );
}

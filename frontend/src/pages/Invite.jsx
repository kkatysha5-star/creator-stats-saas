import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../lib/api.js';
import { finishAuth } from '../lib/authFlow.js';
import styles from './Login.module.css';

export default function Invite() {
  const { token } = useParams();
  const { auth, setAuth } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    localStorage.setItem('pendingInviteToken', token);

    if (auth) {
      setJoining(true);
      finishAuth(setAuth, navigate, token)
        .catch(() => {
          localStorage.removeItem('pendingInviteToken');
          navigate('/');
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (auth || joining) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', fontFamily: 'var(--font)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text2)', fontSize: 14 }}>
          <div style={{ width: 18, height: 18, border: '2px solid rgba(128,128,128,0.2)', borderTop: '2px solid #ff6a00', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
          Присоединяемся…
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const inviteToken = localStorage.getItem('pendingInviteToken');
      let registeredWorkspaceId = null;
      if (tab === 'register') {
        const registered = await api.register({ name, email, password, inviteToken });
        registeredWorkspaceId = registered?.workspace_id;
        if (inviteToken) localStorage.removeItem('pendingInviteToken');
      } else {
        await api.emailLogin({ email, password });
      }
      await finishAuth(setAuth, navigate, tab === 'register' ? null : inviteToken, registeredWorkspaceId);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ background: '#ff6a00', borderRadius: 10, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 16 }}>КМ</div>
          <span style={{ color: 'var(--text)', fontSize: 20, fontWeight: 700 }}>КонтентМетрика</span>
        </div>

        <div style={{ background: 'rgba(255,106,0,0.1)', border: '1px solid rgba(255,106,0,0.25)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, color: 'var(--text2)', width: '100%', textAlign: 'center' }}>
          🎉 Вас пригласили в КонтентМетрику
        </div>

        <div className={styles.tabs}>
          <button className={[styles.tab, tab === 'register' ? styles.tabActive : ''].join(' ')} onClick={() => { setTab('register'); setError(''); }}>
            Регистрация
          </button>
          <button className={[styles.tab, tab === 'login' ? styles.tabActive : ''].join(' ')} onClick={() => { setTab('login'); setError(''); }}>
            Уже есть аккаунт
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {tab === 'register' && (
            <div className={styles.field}>
              <label className={styles.label}>Имя</label>
              <input className={styles.input} type="text" placeholder="Ваше имя" value={name} onChange={e => setName(e.target.value)} required autoComplete="name" />
            </div>
          )}
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input className={styles.input} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Пароль</label>
            <input className={styles.input} type="password" placeholder={tab === 'register' ? 'Минимум 6 символов' : '••••••••'} value={password} onChange={e => setPassword(e.target.value)} required autoComplete={tab === 'register' ? 'new-password' : 'current-password'} />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.submitBtn} type="submit" disabled={loading}>
            {loading ? '…' : tab === 'register' ? 'Создать аккаунт и войти' : 'Войти'}
          </button>
          {loading && tab === 'register' && (
            <p style={{ color: 'var(--text3)', fontSize: 12, margin: 0, textAlign: 'center' }}>
              Создаём аккаунт, это займёт пару секунд…
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

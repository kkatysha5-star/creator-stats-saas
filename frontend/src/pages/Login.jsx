import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../lib/api.js';
import styles from './Login.module.css';

export default function Login() {
  const [tab, setTab] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'register') {
        await api.register({ name, email, password });
      } else {
        await api.emailLogin({ email, password });
      }
      const data = await api.getMe();
      if (data?.workspaces?.length > 0) api.setWorkspace(data.workspaces[0].id);
      setAuth(data);
      navigate(data?.workspaces?.length > 0 ? '/' : '/onboarding');
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
            {loading ? '…' : tab === 'register' ? 'Создать аккаунт' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}

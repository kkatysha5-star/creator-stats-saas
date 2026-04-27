import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import styles from './Login.module.css';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const token = new URLSearchParams(window.location.search).get('token');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return setError('Пароли не совпадают');
    if (password.length < 8) return setError('Пароль — минимум 8 символов');
    if (!token) return setError('Токен не найден');
    setError('');
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      navigate('/login?reset=success');
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
          <div style={{ background: '#ff6a00', borderRadius: 10, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16 }}>КМ</div>
          <span style={{ color: 'var(--text)', fontSize: 20, fontWeight: 700 }}>КонтентМетрика</span>
        </div>

        <h2 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 700, margin: '4px 0 0', letterSpacing: '-0.4px' }}>Новый пароль</h2>
        <p style={{ color: 'var(--text3)', fontSize: 13, margin: 0 }}>Придумайте надёжный пароль</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Новый пароль</label>
            <input
              className={styles.input}
              type="password"
              placeholder="Минимум 8 символов"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Повторите пароль</label>
            <input
              className={styles.input}
              type="password"
              placeholder="Повторите пароль"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.submitBtn} type="submit" disabled={loading}>
            {loading ? '…' : 'Сохранить пароль'}
          </button>
        </form>
      </div>
    </div>
  );
}

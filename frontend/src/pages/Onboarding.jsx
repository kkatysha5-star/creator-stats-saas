import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Btn, Input } from '../components/UI.jsx';
import styles from './Login.module.css';

export default function Onboarding() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!name.trim()) return setError('Введите название контент-завода');
    setLoading(true);
    try {
      const ws = await api.createWorkspace({ name });
      navigate('/');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="9" height="9" rx="2" fill="var(--accent)" opacity="0.9"/>
            <rect x="13" y="2" width="9" height="9" rx="2" fill="var(--accent)" opacity="0.5"/>
            <rect x="2" y="13" width="9" height="9" rx="2" fill="var(--accent)" opacity="0.5"/>
            <rect x="13" y="13" width="9" height="9" rx="2" fill="var(--accent)" opacity="0.7"/>
          </svg>
          <span className={styles.logoText}>Creator Stats</span>
        </div>

        <h1 className={styles.title}>Создайте свой контент-завод</h1>
        <p className={styles.sub}>Введите название — это увидят ваши креаторы</p>

        <div style={{ width: '100%', textAlign: 'left' }}>
          <Input
            label="Название контент-завода"
            placeholder="например: КЗ Анастасии"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
        </div>

        {error && <p style={{ color: '#ff5050', fontSize: 12 }}>{error}</p>}

        <Btn variant="primary" onClick={handleCreate} loading={loading} style={{ width: '100%' }}>
          Создать и начать →
        </Btn>
      </div>
    </div>
  );
}

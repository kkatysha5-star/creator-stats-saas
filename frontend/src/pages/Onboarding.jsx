import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Btn, Input } from '../components/UI.jsx';
import styles from './Login.module.css';

export default function Onboarding() {
  const [step, setStep] = useState('role'); // role | create
  const [role, setRole] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRoleSelect = (r) => {
    setRole(r);
    if (r === 'creator') {
      setStep('waiting');
    } else {
      setStep('create');
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return setError('Введите название');
    setLoading(true);
    try {
      await api.createWorkspace({ name });
      window.location.href = '/'; // полная перезагрузка чтобы обновить auth
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'role') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <div style={{background:'#ff6a00',borderRadius:'10px',width:'40px',height:'40px',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:700,fontSize:'16px'}}>КМ</div>
            <span style={{color:'white',fontSize:'20px',fontWeight:700}}>КонтентМетрика</span>
          </div>

          <h1 className={styles.title}>Кто вы?</h1>
          <p className={styles.sub}>Выберите свою роль</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 8 }}>
            <button
              onClick={() => handleRoleSelect('owner')}
              style={{
                background: 'var(--bg3)', border: '1px solid var(--border2)',
                borderRadius: 'var(--radius)', padding: '16px 20px',
                cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                color: 'var(--text)',
              }}
              onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border2)'}
            >
              <div style={{ fontSize: 20, marginBottom: 4 }}>🏭</div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Владелец контент-завода</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                Управляю командой креаторов, слежу за статистикой и продажами
              </div>
            </button>

            <button
              onClick={() => handleRoleSelect('creator')}
              style={{
                background: 'var(--bg3)', border: '1px solid var(--border2)',
                borderRadius: 'var(--radius)', padding: '16px 20px',
                cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                color: 'var(--text)',
              }}
              onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border2)'}
            >
              <div style={{ fontSize: 20, marginBottom: 4 }}>🎬</div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Креатор</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                Снимаю и публикую видео, жду приглашения от владельца КЗ
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'waiting') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>⏳</div>
          <h1 className={styles.title}>Ожидайте приглашения</h1>
          <p className={styles.sub} style={{ textAlign: 'center' }}>
            Попросите владельца контент-завода отправить вам инвайт-ссылку.
            Как только вы перейдёте по ней — получите доступ к дашборду.
          </p>
          <button
            onClick={() => setStep('role')}
            style={{ background: 'transparent', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', marginTop: 8 }}
          >
            ← Назад
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <div style={{background:'#ff6a00',borderRadius:'10px',width:'40px',height:'40px',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:700,fontSize:'16px'}}>КМ</div>
          <span style={{color:'white',fontSize:'20px',fontWeight:700}}>КонтентМетрика</span>
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

        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          <button
            onClick={() => setStep('role')}
            style={{ background: 'transparent', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--text3)', fontSize: 13, padding: '8px 16px', cursor: 'pointer' }}
          >
            ← Назад
          </button>
          <Btn variant="primary" onClick={handleCreate} loading={loading} style={{ flex: 1 }}>
            Создать и начать →
          </Btn>
        </div>
      </div>
    </div>
  );
}

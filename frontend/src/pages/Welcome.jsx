import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Btn, Input } from '../components/UI.jsx';
import styles from './Welcome.module.css';

export default function Welcome() {
  const [step, setStep] = useState('role');
  const [wsName, setWsName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!wsName.trim()) return setError('Введите название');
    setLoading(true);
    try {
      await api.createWorkspace({ name: wsName });
      window.location.href = '/';
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className={styles.page}>
      {step === 'role' && (
        <div className={styles.card}>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <div style={{background:'#ff6a00',borderRadius:'10px',width:'40px',height:'40px',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:700,fontSize:'16px'}}>КМ</div>
            <span style={{color:'white',fontSize:'20px',fontWeight:700}}>КонтентМетрика</span>
          </div>
          <h1 className={styles.title}>Добро пожаловать!</h1>
          <p className={styles.sub}>Кто вы? Выберите роль чтобы начать</p>

          <div className={styles.roles}>
            <button className={styles.roleCard} onClick={() => setStep('create')}>
              <span className={styles.roleIcon}>🏭</span>
              <div>
                <div className={styles.roleTitle}>Владелец контент-завода</div>
                <div className={styles.roleDesc}>Управляю командой креаторов. Слежу за статистикой роликов, конверсиями и выплатами.</div>
              </div>
              <span className={styles.roleArrow}>→</span>
            </button>

            <button className={styles.roleCard} onClick={() => setStep('creator')}>
              <span className={styles.roleIcon}>🎬</span>
              <div>
                <div className={styles.roleTitle}>Креатор</div>
                <div className={styles.roleDesc}>Снимаю и публикую видео для контент-завода. Буду добавлять ссылки на ролики и следить за своей статистикой.</div>
              </div>
              <span className={styles.roleArrow}>→</span>
            </button>
          </div>
        </div>
      )}

      {step === 'create' && (
        <div className={styles.card}>
          <button className={styles.back} onClick={() => setStep('role')}>← Назад</button>
          <span className={styles.stepIcon}>🏭</span>
          <h1 className={styles.title}>Создайте контент-завод</h1>
          <p className={styles.sub}>Введите название — его увидят ваши креаторы</p>

          <div style={{ width: '100%' }}>
            <Input
              label="Название"
              placeholder="например: КЗ Анастасии"
              value={wsName}
              onChange={e => setWsName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>
          {error && <p style={{ color: '#ff5050', fontSize: 12 }}>{error}</p>}
          <Btn variant="primary" onClick={handleCreate} loading={loading} style={{ width: '100%' }}>
            Создать и перейти на дашборд →
          </Btn>
        </div>
      )}

      {step === 'creator' && (
        <div className={styles.card}>
          <button className={styles.back} onClick={() => setStep('role')}>← Назад</button>
          <span className={styles.stepIcon}>⏳</span>
          <h1 className={styles.title}>Ожидайте приглашения</h1>
          <p className={styles.sub} style={{ textAlign: 'center' }}>
            Попросите владельца контент-завода прислать вам ссылку-приглашение.
          </p>
          <div className={styles.steps}>
            <div className={styles.step}><span>1</span> Владелец КЗ заходит в раздел <strong>Креаторы</strong></div>
            <div className={styles.step}><span>2</span> Нажимает ✉ рядом с вашим именем</div>
            <div className={styles.step}><span>3</span> Копирует ссылку и отправляет вам</div>
            <div className={styles.step}><span>4</span> Вы переходите по ссылке и получаете доступ</div>
          </div>
        </div>
      )}
    </div>
  );
}

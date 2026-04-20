import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../lib/api.js';
import { PageHeader, Avatar, Btn, Input, Modal, Loader } from '../components/UI.jsx';
import styles from './Settings.module.css';

export default function Settings() {
  const { auth, setAuth } = useAuth();
  const navigate = useNavigate();
  const workspace = auth?.workspaces?.[0];
  const user = auth?.user;
  const isOwner = workspace?.role === 'owner';

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wsName, setWsName] = useState(workspace?.name || '');
  const [saving, setSaving] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteRole, setInviteRole] = useState('creator');
  // Для настройки если не завершили онбординг
  const [setupRole, setSetupRole] = useState('');
  const [setupName, setSetupName] = useState('');
  const [setupStep, setSetupStep] = useState(workspace ? 'done' : 'role');
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState('');

  const handleSetupRole = (r) => {
    setSetupRole(r);
    if (r === 'owner') setSetupStep('create');
    else setSetupStep('waiting');
  };

  const handleSetupCreate = async () => {
    if (!setupName.trim()) return setSetupError('Введите название');
    setSetupLoading(true);
    try {
      await api.createWorkspace({ name: setupName });
      window.location.href = '/';
    } catch (e) {
      setSetupError(e.message);
    } finally {
      setSetupLoading(false);
    }
  };

  useEffect(() => {
    if (workspace?.id) {
      api.getMembers(workspace.id)
        .then(setMembers)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [workspace?.id]);

  const handleCreateInvite = async () => {
    try {
      const result = await api.createInvite(workspace.id, { role: inviteRole });
      setInviteUrl(result.url);
    } catch (e) {
      alert(e.message);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    window.location.href = '/login';
  };

  const handleDeleteWorkspace = async () => {
    // Выходим и сбрасываем — пользователь попадёт на онбординг
    await api.logout();
    window.location.href = '/login';
  };

  return (
    <div className={styles.page}>
      <PageHeader title="Настройки" subtitle="Управление профилем и командой" />

      <div className={styles.sections}>

        {/* Незавершённая настройка */}
        {setupStep !== 'done' && (
          <div className={styles.section} style={{ border: '1px solid var(--accent)', background: 'var(--accent-bg)' }}>
            <h2 className={styles.sectionTitle} style={{ color: 'var(--accent)' }}>⚠️ Завершите настройку</h2>

            {setupStep === 'role' && (
              <>
                <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>Выберите свою роль чтобы начать работу</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { value: 'owner', label: '🏭 Владелец контент-завода', desc: 'Управляю командой креаторов, слежу за статистикой и продажами' },
                    { value: 'creator', label: '🎬 Креатор', desc: 'Снимаю видео, жду приглашения от владельца КЗ' },
                  ].map(r => (
                    <button key={r.value} className={styles.roleBtn} onClick={() => handleSetupRole(r.value)}>
                      <span className={styles.roleBtnLabel}>{r.label}</span>
                      <span className={styles.roleBtnDesc}>{r.desc}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {setupStep === 'create' && (
              <>
                <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>Введите название вашего контент-завода</p>
                <Input
                  label="Название"
                  placeholder="например: КЗ Анастасии"
                  value={setupName}
                  onChange={e => setSetupName(e.target.value)}
                />
                {setupError && <p style={{ color: '#ff5050', fontSize: 12 }}>{setupError}</p>}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <Btn onClick={() => setSetupStep('role')}>← Назад</Btn>
                  <Btn variant="primary" onClick={handleSetupCreate} loading={setupLoading}>Создать →</Btn>
                </div>
              </>
            )}

            {setupStep === 'waiting' && (
              <>
                <p style={{ fontSize: 13, color: 'var(--text2)' }}>
                  Вы выбрали роль Креатора. Попросите владельца КЗ отправить вам инвайт-ссылку.
                </p>
                <Btn onClick={() => setSetupStep('role')} style={{ marginTop: 8 }}>← Изменить роль</Btn>
              </>
            )}
          </div>
        )}

        {/* Профиль */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Профиль</h2>
          <div className={styles.profileRow}>
            {user?.avatar
              ? <img src={user.avatar} className={styles.avatar} alt={user.name} />
              : <Avatar name={user?.name || '?'} color="var(--accent)" size={48} />
            }
            <div>
              <div className={styles.profileName}>{user?.name}</div>
              <div className={styles.profileEmail}>{user?.email}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <Btn onClick={handleLogout}>Выйти из аккаунта</Btn>
            <Btn onClick={() => {
              const role = workspace?.role;
              if (role) localStorage.removeItem('tutorial_seen_v1_' + role);
              window.location.reload();
            }}>
              📖 Показать обучение снова
            </Btn>
          </div>
        </div>

        {/* Воркспейс */}
        {workspace && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Контент-завод</h2>
            <div className={styles.roleBadge}>
              Ваша роль: <strong>{workspace.role === 'owner' ? '👑 Владелец' : workspace.role === 'manager' ? '📋 Менеджер' : '🎬 Креатор'}</strong>
            </div>
          </div>
        )}

        {/* Команда — только для owner/manager */}
        {isOwner && workspace && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Команда</h2>

            {loading ? <Loader /> : (
              <div className={styles.membersList}>
                {members.map(m => (
                  <div key={m.id} className={styles.memberRow}>
                    {m.avatar
                      ? <img src={m.avatar} className={styles.memberAvatar} alt={m.name} />
                      : <Avatar name={m.name} color="var(--accent)" size={32} />
                    }
                    <div className={styles.memberInfo}>
                      <span className={styles.memberName}>{m.name}</span>
                      <span className={styles.memberEmail}>{m.email}</span>
                    </div>
                    <span className={styles.memberRole}>
                      {m.role === 'owner' ? '👑' : m.role === 'manager' ? '📋' : '🎬'} {m.role}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Инвайт */}
            <div className={styles.inviteBlock}>
              <h3 className={styles.inviteTitle}>Пригласить в команду</h3>
              <div className={styles.inviteRoles}>
                {[
                  { value: 'creator', label: '🎬 Креатор', desc: 'Видит свои ролики и статистику' },
                  { value: 'manager', label: '📋 Менеджер', desc: 'Видит всё, может редактировать' },
                ].map(r => (
                  <button
                    key={r.value}
                    className={styles.roleBtn + (inviteRole === r.value ? ' ' + styles.roleBtnActive : '')}
                    onClick={() => setInviteRole(r.value)}
                  >
                    <span className={styles.roleBtnLabel}>{r.label}</span>
                    <span className={styles.roleBtnDesc}>{r.desc}</span>
                  </button>
                ))}
              </div>
              <Btn variant="primary" onClick={handleCreateInvite} small>
                Создать ссылку-приглашение
              </Btn>

              {inviteUrl && (
                <div className={styles.inviteUrl}>
                  <span className={styles.inviteUrlText}>{inviteUrl}</span>
                  <button
                    className={styles.copyBtn}
                    onClick={() => { navigator.clipboard.writeText(inviteUrl); alert('Скопировано!'); }}
                  >
                    Скопировать
                  </button>
                </div>
              )}
            </div>
          </div>
        )}



      </div>
    </div>
  );
}

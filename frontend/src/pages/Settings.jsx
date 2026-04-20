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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [inviteRole, setInviteRole] = useState('creator');

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
          <Btn onClick={handleLogout} style={{ marginTop: 12 }}>Выйти из аккаунта</Btn>
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

        {/* Опасная зона */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle} style={{ color: '#f87171' }}>Опасная зона</h2>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>
            Если вы выбрали роль по ошибке или хотите начать заново — выйдите и войдите снова. При следующем входе вы снова увидите выбор роли.
          </p>
          {!showDeleteConfirm ? (
            <Btn onClick={() => setShowDeleteConfirm(true)} style={{ borderColor: 'rgba(248,113,113,.3)', color: '#f87171' }}>
              Выйти и начать заново
            </Btn>
          ) : (
            <div className={styles.confirmBlock}>
              <p style={{ fontSize: 13, color: '#f87171', marginBottom: 8 }}>
                Вы уверены? Вы выйдете из аккаунта и при следующем входе увидите выбор роли.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn onClick={() => setShowDeleteConfirm(false)}>Отмена</Btn>
                <Btn onClick={handleDeleteWorkspace} style={{ borderColor: 'rgba(248,113,113,.3)', color: '#f87171' }}>
                  Да, выйти
                </Btn>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

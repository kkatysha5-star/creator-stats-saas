import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Crown, Film, ClipboardList, Lock, Check, X, Clock } from 'lucide-react';
import { useAuth } from '../App.jsx';
import { TUTORIAL_KEY } from '../components/Tutorial.jsx';
import { api } from '../lib/api.js';
import { PageHeader, Avatar, Btn, Input, Modal, Loader } from '../components/UI.jsx';
import styles from './Settings.module.css';

const PLAN_INFO = {
  trial: { label: 'Пробный (7 дней)', creators: 1, funnel: false, price: 'Бесплатно' },
  start: { label: 'Start', creators: 5, funnel: false, price: '1 990 ₽/мес' },
  pro:   { label: 'Pro', creators: 20, funnel: true,  price: '3 990 ₽/мес' },
  free:  { label: 'Free', creators: 1, funnel: false, price: 'Бесплатно' },
};

function trialDaysLeft(workspace) {
  if (!workspace || workspace.plan !== 'trial' || !workspace.trial_ends_at) return null;
  const diff = new Date(workspace.trial_ends_at) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function Settings() {
  const { auth, setAuth } = useAuth();
  const navigate = useNavigate();
  const workspace = auth?.workspaces?.[0];
  const user = auth?.user;
  const isOwner = workspace?.role === 'owner';

  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteRole, setInviteRole] = useState('creator');
  const [inviteExpiry, setInviteExpiry] = useState('30');
  const [inviteLabel, setInviteLabel] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const isPro = workspace?.plan === 'pro';

  // Настройки видимости для creator роли
  const [visSettings, setVisSettings] = useState({
    creator_sees_all_creators: workspace?.creator_sees_all_creators !== 0,
    creator_sees_funnel: !!workspace?.creator_sees_funnel,
    creator_sees_own_only: !!workspace?.creator_sees_own_only,
  });
  const [savingVis, setSavingVis] = useState(false);

  const handleVisSetting = async (key, value) => {
    const next = { ...visSettings, [key]: value };
    // Логика взаимоисключения: all_creators и own_only не могут быть оба true
    if (key === 'creator_sees_all_creators' && value) next.creator_sees_own_only = false;
    if (key === 'creator_sees_own_only' && value) next.creator_sees_all_creators = false;
    setVisSettings(next);
    setSavingVis(true);
    try {
      await api.updateWorkspaceSettings(workspace.id, next);
      setAuth(prev => ({
        ...prev,
        workspaces: prev.workspaces.map(w =>
          w.id === workspace.id ? { ...w, ...next } : w
        ),
      }));
    } catch (e) { console.error(e); }
    finally { setSavingVis(false); }
  };

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    setSavingName(true);
    try {
      await api.updateMe({ name: newName.trim() });
      setAuth(prev => ({ ...prev, user: { ...prev.user, name: newName.trim() } }));
      setEditingName(false);
    } catch (e) {
      alert(e.message);
    } finally {
      setSavingName(false);
    }
  };

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
    if (!workspace?.id) { setLoading(false); return; }
    Promise.all([
      api.getMembers(workspace.id),
      isOwner ? api.getInvites(workspace.id) : Promise.resolve([]),
    ]).then(([m, inv]) => {
      setMembers(m);
      setInvites(inv);
    }).catch(console.error).finally(() => setLoading(false));
  }, [workspace?.id, isOwner]);

  const handleCreateInvite = async () => {
    setCreatingInvite(true);
    try {
      const result = await api.createInvite(workspace.id, {
        role: inviteRole,
        expires_days: parseInt(inviteExpiry),
        label: inviteLabel.trim() || undefined,
      });
      setInvites(prev => [result, ...prev]);
      setInviteLabel('');
    } catch (e) {
      alert(e.message);
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleDeleteInvite = async (inviteId) => {
    if (!confirm('Удалить эту ссылку?')) return;
    try {
      await api.deleteInvite(workspace.id, inviteId);
      setInvites(prev => prev.filter(i => i.id !== inviteId));
    } catch (e) { alert(e.message); }
  };

  const handleCopy = (inv) => {
    navigator.clipboard.writeText(inv.url);
    setCopiedId(inv.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLogout = async () => {
    await api.logout();
    window.location.href = '/login';
  };

  const plan = workspace?.plan || 'trial';
  const planInfo = PLAN_INFO[plan] || PLAN_INFO.trial;
  const daysLeft = trialDaysLeft(workspace);

  return (
    <div className={styles.page}>
      <PageHeader title="Настройки" subtitle="Управление профилем и командой" />

      <div className={styles.layout}>
      <div className={styles.leftCol}>

        {/* Незавершённая настройка */}
        {setupStep !== 'done' && (
          <div className={styles.section} style={{ border: '1px solid var(--accent)', background: 'var(--accent-bg)' }}>
            <h2 className={styles.sectionTitle} style={{ color: 'var(--accent)' }}>⚠️ Завершите настройку</h2>
            {setupStep === 'role' && (
              <>
                <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>Выберите свою роль чтобы начать работу</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { value: 'owner', label: '🏭 Владелец контент-завода', desc: 'Управляю командой креаторов, слежу за статистикой' },
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
                <Input label="Название" placeholder="например: КЗ Анастасии" value={setupName} onChange={e => setSetupName(e.target.value)} />
                {setupError && <p style={{ color: '#ff5050', fontSize: 12 }}>{setupError}</p>}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <Btn onClick={() => setSetupStep('role')}>← Назад</Btn>
                  <Btn variant="primary" onClick={handleSetupCreate} loading={setupLoading}>Создать →</Btn>
                </div>
              </>
            )}
            {setupStep === 'waiting' && (
              <>
                <p style={{ fontSize: 13, color: 'var(--text2)' }}>Вы выбрали роль Креатора. Попросите владельца КЗ отправить вам инвайт-ссылку.</p>
                <Btn onClick={() => setSetupStep('role')} style={{ marginTop: 8 }}>← Изменить роль</Btn>
              </>
            )}
          </div>
        )}

        {/* Профиль */}
        <div className={styles.section} data-tour="profile-section">
          <h2 className={styles.sectionTitle}>Профиль</h2>
          <div className={styles.profileRow}>
            {user?.avatar
              ? <img src={user.avatar} className={styles.avatar} alt={user.name} />
              : <Avatar name={user?.name || '?'} color="var(--accent)" size={48} />
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              {editingName ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                  <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                    autoFocus
                    style={{ flex: 1, minWidth: 80, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font)', fontSize: 14, fontWeight: 600, padding: '5px 10px', outline: 'none' }}
                  />
                  <Btn variant="primary" onClick={handleSaveName} loading={savingName} small>Сохранить</Btn>
                  <Btn onClick={() => { setEditingName(false); setNewName(user?.name || ''); }} small>Отмена</Btn>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <div className={styles.profileName}>{user?.name}</div>
                  <button
                    onClick={() => { setEditingName(true); setNewName(user?.name || ''); }}
                    title="Изменить имя"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '2px', borderRadius: 4, display: 'flex', alignItems: 'center', lineHeight: 1 }}
                  ><Pencil size={14} strokeWidth={1.5} /></button>
                </div>
              )}
              <div className={styles.profileEmail}>{user?.email}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <Btn onClick={handleLogout}>Выйти из аккаунта</Btn>
            <Btn onClick={() => {
              localStorage.removeItem(TUTORIAL_KEY);
              window.location.reload();
            }}>
              📖 Показать обучение снова
            </Btn>
          </div>
        </div>

        {/* Тариф */}
        {workspace && (
          <div className={styles.section} data-tour="billing-section">
            <h2 className={styles.sectionTitle}>Тариф</h2>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{planInfo.label}</span>
                <span style={{ color: 'var(--text3)', fontSize: 12, marginLeft: 8 }}>{planInfo.price}</span>
              </div>
              {daysLeft !== null && (
                <span style={{ fontSize: 12, color: daysLeft === 0 ? '#ef4444' : daysLeft <= 2 ? '#f59e0b' : 'var(--text3)' }}>
                  {daysLeft === 0
                    ? <><Lock size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} /> Истёк</>
                    : <><Clock size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />{daysLeft} дн.</>}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>Креаторы: до {planInfo.creators}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                Воронка продаж:{' '}
                {planInfo.funnel
                  ? <Check size={12} stroke="#4ade80" strokeWidth={2.5} />
                  : <X size={12} stroke="rgba(255,255,255,0.3)" strokeWidth={2.5} />}
              </span>
            </div>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>Доступные тарифы:</p>
              {[
                { key: 'start', label: 'Start', price: '1 990 ₽/мес', desc: '5 креаторов' },
                { key: 'pro', label: 'Pro', price: '3 990 ₽/мес', desc: '20 креаторов + воронка' },
              ].map(p => (
                <div key={p.key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--bg3)', borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px', border: `1px solid ${workspace.plan === p.key ? 'var(--accent)' : 'var(--border)'}`,
                }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{p.label}</span>
                    <span style={{ color: 'var(--text3)', fontSize: 12, marginLeft: 8 }}>{p.desc}</span>
                  </div>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{p.price}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Воркспейс */}
        {workspace && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Контент-завод</h2>
            <div className={styles.roleBadge}>
              Ваша роль: <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                {workspace.role === 'owner'
                  ? <><Crown size={13} stroke="#ff6a00" strokeWidth={1.8} /> Владелец</>
                  : workspace.role === 'manager'
                  ? <><ClipboardList size={13} stroke="rgba(255,255,255,0.7)" strokeWidth={1.8} /> Менеджер</>
                  : <><Film size={13} stroke="rgba(255,255,255,0.7)" strokeWidth={1.8} /> Креатор</>}
              </strong>
            </div>
          </div>
        )}

        {/* Настройки видимости для креаторов (только owner) */}
        {isOwner && workspace && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle} style={{ marginBottom: 6 }}>Видимость для креаторов</h2>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
              Что видят пользователи с ролью 🎬 Креатор
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <VisSetting
                label="Видят всю команду"
                desc="Каждый креатор видит карточки всех участников"
                value={visSettings.creator_sees_all_creators}
                onChange={v => handleVisSetting('creator_sees_all_creators', v)}
                disabled={savingVis}
              />
              <VisSetting
                label="Видят только себя"
                desc="Каждый креатор видит только свою карточку"
                value={visSettings.creator_sees_own_only}
                onChange={v => handleVisSetting('creator_sees_own_only', v)}
                disabled={savingVis}
              />
              {isPro && (
                <VisSetting
                  label="Видят раздел Воронка"
                  desc="Разрешить просмотр воронки продаж"
                  value={visSettings.creator_sees_funnel}
                  onChange={v => handleVisSetting('creator_sees_funnel', v)}
                  disabled={savingVis}
                />
              )}
              {!isPro && (
                <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Lock size={11} stroke="rgba(255,255,255,0.35)" strokeWidth={2} />
                  Доступ к воронке для креаторов — только на тарифе Pro
                </p>
              )}
            </div>
          </div>
        )}

      </div>{/* /leftCol */}

      {/* Правая колонка — Команда */}
      <div className={styles.rightCol}>
        {isOwner && workspace && (
          <div className={styles.section} data-tour="team-section">
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
                      {m.role === 'owner'
                        ? <Crown size={12} stroke="#ff6a00" strokeWidth={2} />
                        : m.role === 'manager'
                        ? <ClipboardList size={12} stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
                        : <Film size={12} stroke="rgba(255,255,255,0.5)" strokeWidth={2} />}{' '}{m.role}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Создание инвайта */}
            <div className={styles.inviteBlock}>
              <h3 className={styles.inviteTitle}>Создать ссылку-приглашение</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className={styles.inviteRoles}>
                  {[
                    { value: 'creator', label: 'Креатор', desc: 'Видит статистику команды, вносит свои ролики' },
                    { value: 'manager', label: 'Менеджер', desc: 'Вносит изменения в воронку продаж' },
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

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={inviteExpiry}
                    onChange={e => setInviteExpiry(e.target.value)}
                    style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--text2)', fontFamily: 'var(--font)', fontSize: 12, padding: '6px 10px', outline: 'none' }}
                  >
                    <option value="30">30 дней</option>
                    <option value="60">60 дней</option>
                    <option value="90">90 дней</option>
                  </select>
                  <input
                    placeholder="Название (необязательно)"
                    value={inviteLabel}
                    onChange={e => setInviteLabel(e.target.value)}
                    style={{ flex: 1, minWidth: 120, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font)', fontSize: 12, padding: '6px 10px', outline: 'none' }}
                  />
                  <Btn variant="primary" onClick={handleCreateInvite} loading={creatingInvite} small>
                    Создать
                  </Btn>
                </div>
              </div>
            </div>

            {/* Список инвайтов */}
            {invites.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Активные ссылки:</p>
                {invites.map(inv => (
                  <InviteCard
                    key={inv.id}
                    invite={inv}
                    copied={copiedId === inv.id}
                    onCopy={() => handleCopy(inv)}
                    onDelete={() => handleDeleteInvite(inv.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>{/* /rightCol */}

      </div>{/* /layout */}
    </div>
  );
}

function VisSetting({ label, desc, value, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{desc}</div>
      </div>
      <button
        onClick={() => !disabled && onChange(!value)}
        style={{
          width: 40, height: 22, borderRadius: 100, border: 'none', cursor: disabled ? 'default' : 'pointer',
          background: value ? '#ff6a00' : 'var(--bg4)', position: 'relative', flexShrink: 0,
          transition: 'background 200ms', opacity: disabled ? 0.6 : 1,
        }}
      >
        <span style={{
          position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%', background: '#fff',
          left: value ? 21 : 3, transition: 'left 200ms',
        }} />
      </button>
    </div>
  );
}

function InviteCard({ invite, copied, onCopy, onDelete }) {
  const [showJoiners, setShowJoiners] = useState(false);
  const isExpired = invite.is_expired;
  const expiresDate = invite.expires_at ? new Date(invite.expires_at).toLocaleDateString('ru-RU') : '—';
  const roleLabel = { creator: 'Креатор', manager: 'Менеджер', owner: 'Владелец' }[invite.role] || invite.role;

  return (
    <div style={{
      background: 'var(--bg3)', borderRadius: 'var(--radius-sm)',
      border: `1px solid ${isExpired ? '#7f1d1d' : 'var(--border)'}`,
      padding: '10px 12px', marginBottom: 8, opacity: isExpired ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{invite.label || roleLabel}</span>
        <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg4)', padding: '1px 6px', borderRadius: 3 }}>{roleLabel}</span>
        <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>
          {isExpired
            ? <><Lock size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />Истекла</>
            : `до ${expiresDate}`}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {invite.url}
        </span>
        <button
          onClick={onCopy}
          style={{ background: copied ? '#166534' : 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: copied ? '#4ade80' : 'var(--text2)', fontFamily: 'var(--font)', fontSize: 11, padding: '3px 10px', cursor: 'pointer', flexShrink: 0 }}
        >
          {copied ? '✓ Скопировано' : 'Копировать'}
        </button>
        <button
          onClick={onDelete}
          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: '2px 4px', flexShrink: 0 }}
          title="Удалить ссылку"
        >
          ✕
        </button>
      </div>
      {invite.use_count > 0 && (
        <div style={{ marginTop: 6 }}>
          <button
            onClick={() => setShowJoiners(!showJoiners)}
            style={{ fontSize: 11, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            👥 Присоединилось: {invite.use_count} {showJoiners ? '▴' : '▾'}
          </button>
          {showJoiners && invite.joiners?.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 2 }}>
              {invite.joiners.map((j, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{j.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{j.email}</div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0, paddingTop: 2 }}>
                    {new Date(j.joined_at).toLocaleDateString('ru-RU')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

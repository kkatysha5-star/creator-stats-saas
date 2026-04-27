import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { fmtNum } from '../lib/utils.js';
import { PageHeader, Avatar, Btn, Input, Modal, Loader, Empty, showToast, DatePicker } from '../components/UI.jsx';
import { useAuth } from '../App.jsx';
import styles from './Creators.module.css';

const COLORS = ['#7c6cfc','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#06b6d4','#f97316'];

const PLAN_LIMITS = { trial: 1, start: 5, pro: 20, free: 1 };
const PLAN_LABELS = { trial: 'Пробный', start: 'Start', pro: 'Pro', free: 'Free' };

function CreatorLimitModal({ plan, limit, onClose }) {
  const isPro = plan === 'pro';
  return (
    <Modal title="Лимит креаторов достигнут" onClose={onClose} width={420}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '8px 0 4px', textAlign: 'center' }}>
        <div style={{ fontSize: 44, lineHeight: 1 }}>👥</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
            {isPro ? `Достигнут лимит Pro — ${limit} креаторов` : `Лимит тарифа ${PLAN_LABELS[plan] || plan}: ${limit} ${limit === 1 ? 'креатор' : 'креатора'}`}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>
            {isPro
              ? 'Нужно больше 20 креаторов? Обсудим индивидуальные условия.'
              : 'Перейдите на более высокий тариф чтобы добавить больше креаторов.'}
          </div>
        </div>

        {!isPro && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { key: 'start', label: 'Start', limit: 5,  price: '1 990 ₽/мес', current: plan === 'start' },
              { key: 'pro',   label: 'Pro',   limit: 20, price: '3 990 ₽/мес', current: false },
            ].filter(p => PLAN_LIMITS[p.key] > limit).map(p => (
              <div key={p.key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '11px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{p.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>до {p.limit} креаторов</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#ff6a00' }}>{p.price}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <Btn onClick={onClose}>Закрыть</Btn>
        <Btn variant="primary" onClick={() => { window.location.href = '/settings'; }}>
          {isPro ? 'Написать нам' : 'Выбрать тариф →'}
        </Btn>
      </div>
    </Modal>
  );
}

export default function Creators() {
  const { auth } = useAuth();
  const workspace = auth?.workspaces?.[0];
  const plan = workspace?.plan || 'trial';
  const limit = PLAN_LIMITS[plan] ?? 1;
  const role = workspace?.role;
  const canEdit = role === 'owner' || role === 'manager';
  const seesOwnOnly = role === 'creator' && !!workspace?.creator_sees_own_only;
  const userEmail = auth?.user?.email;

  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showLimit, setShowLimit] = useState(false);
  const [editing, setEditing] = useState(null);
  const [inviting, setInviting] = useState(null);
  const [inviteUrl, setInviteUrl] = useState('');

  const atLimit = creators.length >= limit;

  const handleAddClick = () => {
    if (atLimit) setShowLimit(true);
    else {
      setShowAdd(true);
      window.dispatchEvent(new CustomEvent('tour:creator-form-opened'));
    }
  };

  const load = async () => {
    setLoading(true);
    try { setCreators(await api.getCreators()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Удалить креатора и все его видео?')) return;
    await api.deleteCreator(id);
    setCreators(c => c.filter(x => x.id !== id));
  };

  const handleInvite = async (creator) => {
    setInviting(creator);
    setInviteUrl('');
    try {
      const wsResult = await api.getMe();
      const wsId = wsResult?.workspaces?.[0]?.id;
      if (wsId) {
        const result = await api.createInvite(wsId, { role: 'creator' });
        setInviteUrl(result.url);
      }
    } catch (e) { console.error(e); }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="Креаторы"
        subtitle={
          <span>
            Управление командой
            {!loading && (
              <span style={{
                marginLeft: 8, fontSize: 11, fontWeight: 700,
                color: atLimit ? '#f87171' : 'var(--text3)',
                background: atLimit ? 'rgba(248,113,113,0.1)' : 'var(--bg4)',
                border: `1px solid ${atLimit ? 'rgba(248,113,113,0.25)' : 'var(--border)'}`,
                borderRadius: 100, padding: '2px 9px',
              }}>
                {creators.length} / {limit}
              </span>
            )}
          </span>
        }
      >
        {canEdit && (
          <span data-tour="add-creator"><Btn variant="primary" onClick={handleAddClick}>+ Добавить</Btn></span>
        )}
      </PageHeader>

      {loading ? <Loader /> : creators.length === 0
        ? <Empty icon="👤" text="Нет креаторов" sub={canEdit ? 'Добавьте первого креатора' : 'Список пуст'} />
        : (
          <div className={styles.grid + ' fade-in'}>
            {creators
              .filter(c => !seesOwnOnly || c.email === userEmail || c.name === auth?.user?.name)
              .map(c => {
              const monthPlan = c.video_plan_period === 'week'
                ? (c.video_plan_count || 0) * 4
                : (c.video_plan_count || 0);
              return (
                <div key={c.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <Avatar name={c.name} color={c.avatar_color} size={44} />
                    <div className={styles.cardInfo}>
                      <span className={styles.name}>{c.name}</span>
                      {c.email && <p className={styles.username}>{c.email}</p>}
                      {!c.email && c.username && <p className={styles.username}>@{c.username}</p>}
                    </div>
                  </div>
                  {canEdit && (
                    <div className={styles.cardActions}>
                      <button className={styles.iconBtn} onClick={() => handleInvite(c)} data-tour="invite-creator-btn">✉ Пригласить</button>
                      <button className={styles.iconBtn} onClick={() => setEditing(c)}>✎ Изменить</button>
                      <button className={styles.iconBtn + ' ' + styles.del} onClick={() => handleDelete(c.id)}>✕ Удалить</button>
                    </div>
                  )}

                  {(monthPlan > 0 || c.reach_plan > 0) && (
                    <div className={styles.plans}>
                      {monthPlan > 0 && (
                        <div className={styles.planItem}>
                          <span className={styles.planLabel}>🎬 План роликов</span>
                          <span className={styles.planVal}>
                            {c.video_plan_count} / {c.video_plan_period === 'day' ? 'день' : c.video_plan_period === 'week' ? 'нед' : 'мес'}
                          </span>
                        </div>
                      )}
                      {c.reach_plan > 0 && (
                        <div className={styles.planItem}>
                          <span className={styles.planLabel}>👁 План охватов</span>
                          <span className={styles.planVal}>{fmtNum(c.reach_plan)}/мес</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className={styles.colorDot} style={{ background: c.avatar_color }} />
                </div>
              );
            })}
          </div>
        )
      }

      {showAdd && (
        <CreatorModal title="Добавить креатора" colors={COLORS}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            load();
            window.dispatchEvent(new CustomEvent('tour:creator-added'));
          }}
        />
      )}
      {showLimit && (
        <CreatorLimitModal plan={plan} limit={limit} onClose={() => setShowLimit(false)} />
      )}
      {editing && (
        <CreatorModal title="Редактировать" initial={editing} colors={COLORS}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
      {inviting && (
        <InviteModal
          creator={inviting}
          inviteUrl={inviteUrl}
          onClose={() => { setInviting(null); setInviteUrl(''); }}
        />
      )}
    </div>
  );
}

function InviteModal({ creator, inviteUrl, onClose }) {
  return (
    <Modal title={`Пригласить ${creator.name}`} onClose={onClose} width={400}>
      <p style={{ fontSize: 13, color: 'var(--text2)' }}>
        Отправьте эту ссылку {creator.name}. После перехода по ней они войдут через Google и получат доступ к дашборду.
      </p>
      {creator.email && (
        <p style={{ fontSize: 12, color: 'var(--text3)', background: 'var(--bg3)', padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}>
          📧 {creator.email}
        </p>
      )}
      {inviteUrl ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
          <span style={{ flex: 1, fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {inviteUrl}
          </span>
          <button
            onClick={() => { navigator.clipboard.writeText(inviteUrl); showToast('Скопировано!'); }}
            style={{ background: 'var(--accent)', border: 'none', borderRadius: 4, color: '#fff', fontSize: 11, padding: '5px 12px', cursor: 'pointer', flexShrink: 0 }}
          >
            Скопировать
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text3)', fontSize: 13 }}>
          <div style={{ width: 14, height: 14, border: '2px solid var(--border2)', borderTop: '2px solid var(--accent)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
          Генерируем ссылку...
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Btn onClick={onClose}>Закрыть</Btn>
      </div>
    </Modal>
  );
}

function CreatorModal({ title, initial, colors, onClose, onSaved }) {
  const [name, setName] = useState(initial?.name || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [username, setUsername] = useState(initial?.username || '');
  const [color, setColor] = useState(initial?.avatar_color || colors[0]);
  const [videoPlanCount, setVideoPlanCount] = useState(initial?.video_plan_count || '');
  const [videoPlanPeriod, setVideoPlanPeriod] = useState(initial?.video_plan_period || 'month');
  const [dailyRate, setDailyRate] = useState(initial?.daily_rate || '');
  const [reachPlan, setReachPlan] = useState(initial?.reach_plan || '');
  const [periodStart, setPeriodStart] = useState(initial?.period_start || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) return setError('Введите имя');
    setLoading(true);
    try {
      const data = {
        name, email: email || null, username, avatar_color: color,
        video_plan_count: parseInt(videoPlanCount) || 0,
        video_plan_period: videoPlanPeriod,
        daily_rate: parseInt(dailyRate) || 0,
        reach_plan: parseInt(reachPlan) || 0,
        period_start: periodStart || null,
      };
      if (initial) {
        await api.updateCreator(initial.id, data);
      } else {
        await api.createCreator(data);
      }
      onSaved();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal title={title} onClose={onClose} width={380} data-tour="creator-modal">
      <Input label="Имя" placeholder="Анна К." value={name} onChange={e => setName(e.target.value)} />
      <Input label="Email (для приглашения)" placeholder="anna@example.com" type="email" value={email} onChange={e => setEmail(e.target.value)} />
      <Input label="Username (необязательно)" placeholder="@username" value={username} onChange={e => setUsername(e.target.value)} />

      <div>
        <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6, fontWeight: 500 }}>🎬 План роликов</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Input placeholder="0" type="number" value={videoPlanCount} onChange={e => setVideoPlanCount(e.target.value)} />
          <select value={videoPlanPeriod} onChange={e => setVideoPlanPeriod(e.target.value)}
            style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font)', fontSize: 13, padding: '8px 10px', outline: 'none', flexShrink: 0, cursor: 'pointer' }}>
            <option value="day">в день</option>
            <option value="week">в неделю</option>
            <option value="month">в месяц</option>
          </select>
        </div>
      </div>

      <Input label="📅 Роликов в день (для расчёта отставания)" placeholder="2" type="number" value={dailyRate} onChange={e => setDailyRate(e.target.value)} />
      <Input label="👁 План охватов в месяц (просмотры)" placeholder="0" type="number" value={reachPlan} onChange={e => setReachPlan(e.target.value)} />
      <DatePicker label="Дата старта расчётного периода" value={periodStart} onChange={v => setPeriodStart(v)} />

      <div>
        <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8, fontWeight: 500 }}>Цвет аватара</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {colors.map(c => (
            <button key={c} onClick={() => setColor(c)} style={{
              width: 28, height: 28, borderRadius: 7, background: c,
              border: color === c ? '2px solid #fff' : '2px solid transparent',
              cursor: 'pointer', outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 1,
            }} />
          ))}
        </div>
      </div>

      {name && <Avatar name={name} color={color} size={40} />}
      {error && <p style={{ color: '#ff5050', fontSize: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn onClick={onClose}>Отмена</Btn>
        <Btn variant="primary" onClick={handleSave} loading={loading}>Сохранить</Btn>
      </div>
    </Modal>
  );
}

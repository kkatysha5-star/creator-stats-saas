import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { fmtNum } from '../lib/utils.js';
import { PageHeader, Avatar, Btn, Input, Modal, Loader, Empty } from '../components/UI.jsx';
import styles from './Creators.module.css';

const COLORS = ['#7c6cfc','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#06b6d4','#f97316'];

export default function Creators() {
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);

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

  return (
    <div className={styles.page}>
      <PageHeader title="Креаторы" subtitle="Управление списком креаторов">
        <Btn variant="primary" onClick={() => setShowAdd(true)}>+ Добавить</Btn>
      </PageHeader>

      {loading ? <Loader /> : creators.length === 0
        ? <Empty icon="👤" text="Нет креаторов" sub="Добавьте первого креатора" />
        : (
          <div className={styles.grid + ' fade-in'}>
            {creators.map(c => {
              const monthPlan = c.video_plan_period === 'week'
                ? (c.video_plan_count || 0) * 4
                : (c.video_plan_count || 0);
              return (
                <div key={c.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <Avatar name={c.name} color={c.avatar_color} size={44} />
                    <div className={styles.cardInfo}>
                      <p className={styles.name}>{c.name}</p>
                      {c.username && <p className={styles.username}>@{c.username}</p>}
                    </div>
                    <div className={styles.cardActions}>
                      <button className={styles.iconBtn} onClick={() => setEditing(c)} title="Редактировать">✎</button>
                      <button className={styles.iconBtn + ' ' + styles.del} onClick={() => handleDelete(c.id)} title="Удалить">✕</button>
                    </div>
                  </div>

                  {/* Планы */}
                  {(monthPlan > 0 || c.reach_plan > 0) && (
                    <div className={styles.plans}>
                      {monthPlan > 0 && (
                        <div className={styles.planItem}>
                          <span className={styles.planLabel}>🎬 План роликов</span>
                          <span className={styles.planVal}>
                            {c.video_plan_count} / {c.video_plan_period === 'day' ? 'день' : c.video_plan_period === 'week' ? 'нед' : 'мес'}
                            {c.video_plan_period === 'week' && <span className={styles.planSub}> ({monthPlan}/мес)</span>}
                            {c.video_plan_period === 'day' && <span className={styles.planSub}> (~{(c.video_plan_count||0)*30}/мес)</span>}
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
        <CreatorModal
          title="Добавить креатора"
          colors={COLORS}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}
      {editing && (
        <CreatorModal
          title="Редактировать"
          initial={editing}
          colors={COLORS}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function CreatorModal({ title, initial, colors, onClose, onSaved }) {
  const [name, setName] = useState(initial?.name || '');
  const [username, setUsername] = useState(initial?.username || '');
  const [color, setColor] = useState(initial?.avatar_color || colors[0]);
  const [videoPlanCount, setVideoPlanCount] = useState(initial?.video_plan_count || '');
  const [videoPlanPeriod, setVideoPlanPeriod] = useState(initial?.video_plan_period || 'month');
  const [dailyRate, setDailyRate] = useState(initial?.daily_rate || '');
  const [reachPlan, setReachPlan] = useState(initial?.reach_plan || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) return setError('Введите имя');
    setLoading(true);
    try {
      const data = {
        name, username, avatar_color: color,
        video_plan_count: parseInt(videoPlanCount) || 0,
        video_plan_period: videoPlanPeriod,
        daily_rate: parseInt(dailyRate) || 0,
        reach_plan: parseInt(reachPlan) || 0,
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

  const monthEquiv = videoPlanPeriod === 'week' && videoPlanCount
    ? `= ${parseInt(videoPlanCount) * 4} роликов в месяц`
    : videoPlanPeriod === 'day' && videoPlanCount
    ? `= ~${parseInt(videoPlanCount) * 30} роликов в месяц`
    : null;

  return (
    <Modal title={title} onClose={onClose} width={380}>
      <Input label="Имя" placeholder="Анна К." value={name} onChange={e => setName(e.target.value)} />
      <Input label="Username (необязательно)" placeholder="@username" value={username} onChange={e => setUsername(e.target.value)} />

      {/* План роликов */}
      <div>
        <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6, fontWeight: 500 }}>🎬 План роликов</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Input
            placeholder="0"
            type="number"
            value={videoPlanCount}
            onChange={e => setVideoPlanCount(e.target.value)}
          />
          <select
            value={videoPlanPeriod}
            onChange={e => setVideoPlanPeriod(e.target.value)}
            style={{
              background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)',
              color: 'var(--text)', fontFamily: 'var(--font)', fontSize: 13, padding: '8px 10px',
              outline: 'none', flexShrink: 0, cursor: 'pointer'
            }}
          >
            <option value="day">в день</option>
            <option value="week">в неделю</option>
            <option value="month">в месяц</option>
          </select>
        </div>
        {monthEquiv && <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{monthEquiv}</p>}
      </div>

      {/* Роликов в день для расчёта отставания */}
      <Input
        label="📅 Роликов в день (для расчёта отставания)"
        placeholder="2"
        type="number"
        value={dailyRate}
        onChange={e => setDailyRate(e.target.value)}
      />
      {dailyRate && videoPlanCount && (
        <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: -8 }}>
          При {dailyRate} рол/день план {videoPlanCount} {videoPlanPeriod === 'month' ? 'в месяц' : videoPlanPeriod === 'week' ? 'в неделю' : 'в день'} закроется за ~{Math.ceil(parseInt(videoPlanCount) / parseInt(dailyRate))} дней
        </p>
      )}

      {/* План охватов */}
      <Input
        label="👁 План охватов в месяц (просмотры)"
        placeholder="0"
        type="number"
        value={reachPlan}
        onChange={e => setReachPlan(e.target.value)}
      />

      {/* Цвет */}
      <div>
        <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8, fontWeight: 500 }}>Цвет аватара</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {colors.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: 28, height: 28, borderRadius: 7, background: c,
                border: color === c ? '2px solid #fff' : '2px solid transparent',
                cursor: 'pointer', outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 1,
              }}
            />
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

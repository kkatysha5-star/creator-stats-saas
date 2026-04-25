import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../lib/api.js';
import { fmtNum } from '../lib/utils.js';
import { PageHeader, Avatar, Btn, Input, Select, Modal, Loader, Empty } from '../components/UI.jsx';
import { useAuth } from '../App.jsx';
import styles from './Funnel.module.css';

const ADMIN_KEY = 'funnel_admin_unlocked';

const PLAN_HAS_FUNNEL = { pro: true };

function FunnelUpgradeWall() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '80px 24px', gap: 16, textAlign: 'center',
    }}>
      <div style={{ fontSize: 48, lineHeight: 1 }}>📊</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: -0.4 }}>
        Воронка продаж — тариф Pro
      </div>
      <div style={{ fontSize: 14, color: 'var(--text3)', maxWidth: 380, lineHeight: 1.6 }}>
        Отслеживайте конверсии от охвата до заказа, сравнивайте периоды и считайте CAC.
        Доступно на тарифе <strong style={{ color: '#ff6a00' }}>Pro</strong> за 3 990 ₽/мес.
      </div>
      <div style={{
        marginTop: 8, background: 'var(--card-bg)',
        border: '1px solid var(--card-border)', borderTop: '1px solid var(--card-border-top)',
        borderRadius: 'var(--radius)', padding: '20px 28px',
        display: 'flex', flexDirection: 'column', gap: 8, minWidth: 280,
      }}>
        {['Охват → Заходы → Корзина → Заказы', 'Сравнение периодов', 'CAC и CPM по каждому креатору', 'До 20 креаторов'].map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text2)' }}>
            <span style={{ color: '#4ade80', fontWeight: 700 }}>✓</span> {f}
          </div>
        ))}
      </div>
      <Btn variant="primary" onClick={() => window.location.href = '/settings'}>
        Перейти на Pro →
      </Btn>
    </div>
  );
}

function fmt(n) {
  if (n == null || isNaN(n)) return '—';
  return parseFloat(n).toFixed(2).replace('.', ',') + '%';
}
function fmtRub(n) {
  if (n == null) return '—';
  return '₽\u202F' + fmtNum(Math.round(n));
}
function delta(curr, prev) {
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr - prev) / prev * 100).toFixed(1);
}

export default function Funnel() {
  const { auth } = useAuth();
  const workspace = auth?.workspaces?.[0];
  const hasFunnel = PLAN_HAS_FUNNEL[workspace?.plan] ?? false;

  if (!hasFunnel) {
    return (
      <div className={styles.page}>
        <PageHeader title="Воронка продаж" subtitle="Конверсии и продажи по периодам" />
        <FunnelUpgradeWall />
      </div>
    );
  }

  return <FunnelInner />;
}

function FunnelInner() {
  const [periods, setPeriods] = useState([]);
  const [privateData, setPrivateData] = useState({});
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem(ADMIN_KEY) === '1');
  const [showLogin, setShowLogin] = useState(false);
  const [showNewPeriod, setShowNewPeriod] = useState(false);
  const [showSnapshot, setShowSnapshot] = useState(null);
  const [showEdit, setShowEdit] = useState(null);
  const [selectedLabel, setSelectedLabel] = useState('');
  const [compareTo, setCompareTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ps, crs] = await Promise.all([api.getFunnelPeriods(), api.getCreators()]);
      setPeriods(ps);
      setCreators(crs);
      if (isAdmin) {
        try {
          const priv = await api.getFunnelPrivate();
          const map = {};
          priv.forEach(p => { map[p.id] = p; });
          setPrivateData(map);
        } catch {}
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  // Уникальные метки периодов (месяцы) — для переключателя
  const labels = useMemo(() => {
    const seen = new Set();
    const result = [];
    periods.forEach(p => {
      if (!seen.has(p.label)) { seen.add(p.label); result.push(p.label); }
    });
    return result;
  }, [periods]);

  // Выбираем первый по умолчанию
  useEffect(() => {
    if (labels.length && !selectedLabel) setSelectedLabel(labels[0]);
  }, [labels]);

  const handleLogin = async (pwd) => {
    sessionStorage.setItem('funnel_admin_pwd', pwd);
    const ok = await api.checkAdminPassword(pwd);
    if (ok) {
      sessionStorage.setItem(ADMIN_KEY, '1');
      setIsAdmin(true);
      setShowLogin(false);
    } else {
      sessionStorage.removeItem('funnel_admin_pwd');
      alert('Неверный пароль');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_KEY);
    sessionStorage.removeItem('funnel_admin_pwd');
    setIsAdmin(false);
    setPrivateData({});
  };

  // Периоды выбранного месяца
  const currentPeriods = useMemo(() =>
    periods.filter(p => p.label === selectedLabel),
    [periods, selectedLabel]
  );

  // Периоды для сравнения
  const comparePeriods = useMemo(() =>
    periods.filter(p => p.label === compareTo),
    [periods, compareTo]
  );

  const compareMap = useMemo(() => {
    const m = {};
    comparePeriods.forEach(p => { m[p.creator_id] = p; });
    return m;
  }, [comparePeriods]);

  const COLS = [
    { key: 'total_views',       label: 'Охват',        fmt: fmtNum },
    { key: 'visits',            label: 'Заходы',       fmt: fmtNum },
    { key: 'conv_visit_reach',  label: 'Зах/Охв',      fmt: fmt },
    { key: 'cart',              label: 'Корзина',      fmt: fmtNum },
    { key: 'conv_cart_visit',   label: 'Корз/Зах',     fmt: fmt },
    { key: 'conv_cart_reach',   label: 'Корз/Охв',     fmt: fmt },
    { key: 'orders',            label: 'Заказы',       fmt: fmtNum },
    { key: 'conv_order_cart',   label: 'Зак/Корз',     fmt: fmt },
    { key: 'conv_order_reach',  label: 'Зак/Охв',      fmt: fmt },
    { key: 'cpm',               label: 'CPM',          fmt: fmtRub },
  ];

  const ADMIN_COLS = [
    { key: 'payout', label: 'Выплата 🔒', fmt: fmtRub, private: true },
    { key: 'cac',    label: 'CAC 🔒',     fmt: fmtRub, private: true },
  ];

  const allCols = isAdmin ? [...COLS, ...ADMIN_COLS] : COLS;

  return (
    <div className={styles.page}>
      <PageHeader title="Воронка продаж" subtitle="Конверсии и продажи по периодам">
        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin ? (
            <>
              <Btn variant="primary" small onClick={() => setShowNewPeriod(true)}>+ Период</Btn>
              <Btn small onClick={handleLogout}>Выйти</Btn>
            </>
          ) : (
            <Btn small onClick={() => setShowLogin(true)}>🔒 Редактировать</Btn>
          )}
        </div>
      </PageHeader>

      {/* Переключатель месяца */}
      <div className={styles.toolbar}>
        <div className={styles.labelTabs}>
          {labels.map(l => (
            <button
              key={l}
              className={styles.labelTab + (selectedLabel === l ? ' ' + styles.labelTabActive : '')}
              onClick={() => setSelectedLabel(l)}
            >{l}</button>
          ))}
        </div>
        {labels.length > 1 && (
          <div className={styles.compareWrap}>
            <span className={styles.compareLabel}>Сравнить с:</span>
            <select className={styles.filterSelect} value={compareTo} onChange={e => setCompareTo(e.target.value)}>
              <option value="">— нет —</option>
              {labels.filter(l => l !== selectedLabel).map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? <Loader /> : currentPeriods.length === 0
        ? <Empty icon="📊" text="Нет данных за этот период" sub={isAdmin ? 'Создайте периоды для креаторов' : 'Данные ещё не внесены'} />
        : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thCreator}>Креатор</th>
                  {allCols.map(c => (
                    <th key={c.key} className={styles.th + (c.private ? ' ' + styles.thPrivate : '')}>{c.label}</th>
                  ))}
                  {isAdmin && <th className={styles.th}>Действия</th>}
                </tr>
              </thead>
              <tbody>
                {currentPeriods.map(p => {
                  const prev = compareMap[p.creator_id];
                  const priv = privateData[p.id];
                  return (
                    <tr key={p.id} className={styles.tr}>
                      <td className={styles.tdCreator}>
                        <div className={styles.tdCreatorInner}>
                          <Avatar name={p.creator_name} color={p.avatar_color} size={26} />
                          <div>
                            <div className={styles.creatorName}>{p.creator_name}</div>
                            <div className={styles.periodDates}>{p.date_from} — {p.date_to || 'сейчас'}</div>
                          </div>
                        </div>
                      </td>
                      {COLS.map(c => {
                        const val = p[c.key];
                        const prevVal = prev ? prev[c.key] : null;
                        const d = delta(val, prevVal);
                        return (
                          <td key={c.key} className={styles.td}>
                            <span className={styles.tdVal}>{c.fmt(val)}</span>
                            {d != null && (
                              <span className={styles.delta + ' ' + (parseFloat(d) >= 0 ? styles.up : styles.down)}>
                                {parseFloat(d) >= 0 ? '↑' : '↓'}{Math.abs(d)}%
                              </span>
                            )}
                          </td>
                        );
                      })}
                      {isAdmin && ADMIN_COLS.map(c => {
                        const val = priv ? priv[c.key] : null;
                        return (
                          <td key={c.key} className={styles.td + ' ' + styles.tdPrivate}>
                            <span className={styles.tdVal}>{c.fmt(val)}</span>
                          </td>
                        );
                      })}
                      {isAdmin && (
                        <td className={styles.td}>
                          <div className={styles.actions}>
                            <button className={styles.iconBtn} onClick={() => setShowSnapshot(p)} title="Внести данные">+</button>
                            <button className={styles.iconBtn} onClick={() => setShowEdit(p)} title="Редактировать">✎</button>
                            <button className={styles.iconBtn + ' ' + styles.del} onClick={async () => {
                              if (!confirm('Удалить период?')) return;
                              await api.deleteFunnelPeriod(p.id);
                              load();
                            }} title="Удалить">✕</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      }

      {/* История снимков под таблицей */}
      {currentPeriods.some(p => p.snapshots?.length > 0) && (
        <div className={styles.historySection}>
          <h2 className={styles.sectionTitle}>История записей</h2>
          {currentPeriods.map(p => p.snapshots?.length > 0 && (
            <HistoryBlock key={p.id} period={p} isAdmin={isAdmin} onDelete={async (sid) => {
              if (!confirm('Удалить запись?')) return;
              await api.deleteFunnelSnapshot(sid);
              load();
            }} />
          ))}
        </div>
      )}

      {showLogin && <LoginModal onLogin={handleLogin} onClose={() => setShowLogin(false)} />}
      {showNewPeriod && <NewPeriodModal creators={creators} onClose={() => setShowNewPeriod(false)} onSaved={() => { setShowNewPeriod(false); load(); }} />}
      {showSnapshot && <SnapshotModal period={showSnapshot} onClose={() => setShowSnapshot(null)} onSaved={() => { setShowSnapshot(null); load(); }} />}
      {showEdit && <EditPeriodModal period={showEdit} onClose={() => setShowEdit(null)} onSaved={() => { setShowEdit(null); load(); }} />}
    </div>
  );
}

function HistoryBlock({ period: p, isAdmin, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.historyBlock}>
      <div className={styles.historyHeader} onClick={() => setOpen(!open)}>
        <Avatar name={p.creator_name} color={p.avatar_color} size={20} />
        <span>{p.creator_name} — {p.label}</span>
        <span className={styles.historyCount}>{p.snapshots.length} зап.</span>
        <span>{open ? '▴' : '▾'}</span>
      </div>
      {open && (
        <div className={styles.historyRows}>
          {p.snapshots.map(s => (
            <div key={s.id} className={styles.historyRow}>
              <span className={styles.historyDate}>{s.recorded_at?.slice(0, 10)}</span>
              <span>👁 {fmtNum(s.visits)}</span>
              <span>🛒 {fmtNum(s.cart)}</span>
              <span>✅ {fmtNum(s.orders)}</span>
              {s.note && <span className={styles.note}>{s.note}</span>}
              {isAdmin && <button className={styles.iconBtn + ' ' + styles.del + ' ' + styles.tiny} onClick={() => onDelete(s.id)}>✕</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LoginModal({ onLogin, onClose }) {
  const [pwd, setPwd] = useState('');
  return (
    <Modal title="Вход для редактирования" onClose={onClose}>
      <Input label="Пароль" type="password" value={pwd} onChange={e => setPwd(e.target.value)} onKeyDown={e => e.key === 'Enter' && onLogin(pwd)} autoFocus />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn onClick={onClose}>Отмена</Btn>
        <Btn variant="primary" onClick={() => onLogin(pwd)}>Войти</Btn>
      </div>
    </Modal>
  );
}

function NewPeriodModal({ creators, onClose, onSaved }) {
  const [creatorId, setCreatorId] = useState(creators[0]?.id || '');
  const [label, setLabel] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!label || !dateFrom) return setError('Заполните название и дату начала');
    setLoading(true);
    try {
      await api.createFunnelPeriod({ creator_id: parseInt(creatorId), label, date_from: dateFrom, date_to: dateTo || undefined });
      onSaved();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="Новый период" onClose={onClose}>
      <p style={{ fontSize: 12, color: 'var(--text3)' }}>Название используется для группировки — у всех креаторов одного месяца оно должно совпадать, например «Апрель 26»</p>
      <Select label="Креатор" value={creatorId} onChange={e => setCreatorId(e.target.value)}>
        {creators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
      <Input label="Название периода" placeholder="Апрель 26" value={label} onChange={e => setLabel(e.target.value)} />
      <Input label="Дата начала работы этого креатора" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
      <Input label="Дата окончания (можно оставить пустой)" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
      {error && <p style={{ color: '#ff5050', fontSize: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn onClick={onClose}>Отмена</Btn>
        <Btn variant="primary" onClick={handleSave} loading={loading}>Создать</Btn>
      </div>
    </Modal>
  );
}

function SnapshotModal({ period, onClose, onSaved }) {
  const [visits, setVisits] = useState('');
  const [cart, setCart] = useState('');
  const [orders, setOrders] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!visits) return setError('Введите хотя бы заходы');
    setLoading(true);
    try {
      await api.addFunnelSnapshot(period.id, { visits: parseInt(visits), cart: parseInt(cart) || 0, orders: parseInt(orders) || 0, note });
      onSaved();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal title={`Внести данные — ${period.creator_name}, ${period.label}`} onClose={onClose}>
      <p style={{ fontSize: 12, color: 'var(--text3)' }}>Накопительно с {period.date_from} по сегодня</p>
      <Input label="Заходы по артикулу" type="number" placeholder="0" value={visits} onChange={e => setVisits(e.target.value)} />
      <Input label="Положили в корзину" type="number" placeholder="0" value={cart} onChange={e => setCart(e.target.value)} />
      <Input label="Купили (заказы)" type="number" placeholder="0" value={orders} onChange={e => setOrders(e.target.value)} />
      <Input label="Заметка (необязательно)" placeholder="данные за 1–7 апр" value={note} onChange={e => setNote(e.target.value)} />
      {error && <p style={{ color: '#ff5050', fontSize: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn onClick={onClose}>Отмена</Btn>
        <Btn variant="primary" onClick={handleSave} loading={loading}>Сохранить</Btn>
      </div>
    </Modal>
  );
}

function EditPeriodModal({ period, onClose, onSaved }) {
  const [label, setLabel] = useState(period.label);
  const [dateTo, setDateTo] = useState(period.date_to || '');
  const [payout, setPayout] = useState('');
  const [isActive, setIsActive] = useState(!!period.is_active);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.updateFunnelPeriod(period.id, { label, date_to: dateTo || null, payout: payout ? parseFloat(payout) : null, is_active: isActive ? 1 : 0 });
      onSaved();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="Редактировать период" onClose={onClose}>
      <Input label="Название" value={label} onChange={e => setLabel(e.target.value)} />
      <Input label="Дата окончания" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
      <Input label="Выплата креатору (₽) 🔒" type="number" placeholder="0" value={payout} onChange={e => setPayout(e.target.value)} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
        <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
        Активный период
      </label>
      {error && <p style={{ color: '#ff5050', fontSize: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn onClick={onClose}>Отмена</Btn>
        <Btn variant="primary" onClick={handleSave} loading={loading}>Сохранить</Btn>
      </div>
    </Modal>
  );
}

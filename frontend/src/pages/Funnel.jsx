import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';
import { fmtNum, platformMeta } from '../lib/utils.js';
import { PageHeader, Avatar, Btn, Input, Select, Modal, Loader, Empty } from '../components/UI.jsx';
import styles from './Funnel.module.css';

const ADMIN_KEY = 'funnel_admin_unlocked';

function fmt(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—';
  return parseFloat(n).toFixed(decimals).replace('.', ',') + '%';
}
function fmtRub(n) {
  if (n == null) return '—';
  return '₽\u202F' + fmtNum(Math.round(n));
}

export default function Funnel() {
  const [periods, setPeriods] = useState([]);
  const [privateData, setPrivateData] = useState({});
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem(ADMIN_KEY) === '1');
  const [showLogin, setShowLogin] = useState(false);
  const [showNewPeriod, setShowNewPeriod] = useState(false);
  const [showSnapshot, setShowSnapshot] = useState(null); // period object
  const [showEdit, setShowEdit] = useState(null);
  const [selectedCreator, setSelectedCreator] = useState('');
  const [showActive, setShowActive] = useState(true);

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

  const filtered = periods.filter(p => {
    if (selectedCreator && String(p.creator_id) !== String(selectedCreator)) return false;
    if (showActive && !p.is_active) return false;
    if (!showActive && p.is_active) return false;
    return true;
  });

  // Группируем по креатору
  const byCreator = {};
  filtered.forEach(p => {
    if (!byCreator[p.creator_id]) byCreator[p.creator_id] = { name: p.creator_name, color: p.avatar_color, periods: [] };
    byCreator[p.creator_id].periods.push(p);
  });

  return (
    <div className={styles.page}>
      <PageHeader title="Воронка продаж" subtitle="Конверсии и продажи по периодам">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isAdmin ? (
            <>
              <Btn variant="primary" small onClick={() => setShowNewPeriod(true)}>+ Новый период</Btn>
              <Btn small onClick={handleLogout}>Выйти</Btn>
            </>
          ) : (
            <Btn small onClick={() => setShowLogin(true)}>🔒 Режим редактирования</Btn>
          )}
        </div>
      </PageHeader>

      <div className={styles.toolbar}>
        <select className={styles.filterSelect} value={selectedCreator} onChange={e => setSelectedCreator(e.target.value)}>
          <option value="">Все креаторы</option>
          {creators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className={styles.toggleWrap}>
          <button className={styles.toggleBtn + (showActive ? ' ' + styles.toggleActive : '')} onClick={() => setShowActive(true)}>Активные</button>
          <button className={styles.toggleBtn + (!showActive ? ' ' + styles.toggleActive : '')} onClick={() => setShowActive(false)}>Архив</button>
        </div>
      </div>

      {loading ? <Loader /> : Object.keys(byCreator).length === 0
        ? <Empty icon="📊" text="Нет данных" sub={isAdmin ? 'Создайте первый период' : 'Данные ещё не внесены'} />
        : (
          <div className={styles.content}>
            {Object.entries(byCreator).map(([creatorId, { name, color, periods: cPeriods }]) => (
              <div key={creatorId} className={styles.creatorBlock}>
                <div className={styles.creatorHeader}>
                  <Avatar name={name} color={color} size={28} />
                  <span className={styles.creatorName}>{name}</span>
                </div>

                <div className={styles.periodsGrid}>
                  {cPeriods.map(p => {
                    const priv = privateData[p.id];
                    return (
                      <PeriodCard
                        key={p.id}
                        period={p}
                        privateData={priv}
                        isAdmin={isAdmin}
                        onAddSnapshot={() => setShowSnapshot(p)}
                        onEdit={() => setShowEdit(p)}
                        onDelete={async () => {
                          if (!confirm('Удалить период и все данные?')) return;
                          await api.deleteFunnelPeriod(p.id);
                          load();
                        }}
                        onDeleteSnapshot={async (snapId) => {
                          if (!confirm('Удалить эту запись?')) return;
                          await api.deleteFunnelSnapshot(snapId);
                          load();
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      }

      {showLogin && <LoginModal onLogin={handleLogin} onClose={() => setShowLogin(false)} />}
      {showNewPeriod && <NewPeriodModal creators={creators} onClose={() => setShowNewPeriod(false)} onSaved={() => { setShowNewPeriod(false); load(); }} />}
      {showSnapshot && <SnapshotModal period={showSnapshot} onClose={() => setShowSnapshot(null)} onSaved={() => { setShowSnapshot(null); load(); }} />}
      {showEdit && <EditPeriodModal period={showEdit} onClose={() => setShowEdit(null)} onSaved={() => { setShowEdit(null); load(); }} />}
    </div>
  );
}

function PeriodCard({ period: p, privateData, isAdmin, onAddSnapshot, onEdit, onDelete, onDeleteSnapshot }) {
  const [expanded, setExpanded] = useState(false);

  const rows = [
    { label: 'Охват', value: fmtNum(p.total_views), hint: null },
    { label: 'Заходов по арт.', value: fmtNum(p.visits), hint: null },
    { label: 'Конв. заход/охват', value: fmt(p.conv_visit_reach), hint: 'visits / views' },
    { label: 'Корзина', value: fmtNum(p.cart), hint: null },
    { label: 'Конв. корзина/заход', value: fmt(p.conv_cart_visit), hint: 'cart / visits' },
    { label: 'Конв. корзина/охват', value: fmt(p.conv_cart_reach), hint: 'cart / views' },
    { label: 'Заказы', value: fmtNum(p.orders), hint: null },
    { label: 'Конв. заказ/корзина', value: fmt(p.conv_order_cart), hint: 'orders / cart' },
    { label: 'Конв. заказ/охват', value: fmt(p.conv_order_reach), hint: 'orders / views' },
    { label: 'CPM', value: fmtRub(p.cpm), hint: 'payout / views × 1000' },
  ];

  if (isAdmin && privateData) {
    rows.push({ label: 'Выплата', value: fmtRub(privateData.payout), hint: null, private: true });
    rows.push({ label: 'CAC', value: fmtRub(privateData.cac), hint: 'payout / orders', private: true });
  }

  return (
    <div className={styles.periodCard}>
      <div className={styles.periodHeader}>
        <div>
          <span className={styles.periodLabel}>{p.label}</span>
          <span className={styles.periodDates}>{p.date_from} — {p.date_to || 'сейчас'}</span>
        </div>
        <div className={styles.periodActions}>
          {isAdmin && (
            <>
              <button className={styles.iconBtn} onClick={onAddSnapshot} title="Внести данные">+</button>
              <button className={styles.iconBtn} onClick={onEdit} title="Редактировать">✎</button>
              <button className={styles.iconBtn + ' ' + styles.del} onClick={onDelete} title="Удалить">✕</button>
            </>
          )}
        </div>
      </div>

      <div className={styles.metricsGrid}>
        {rows.map(r => (
          <div key={r.label} className={styles.metricRow + (r.private ? ' ' + styles.privateRow : '')}>
            <span className={styles.metricLabel}>{r.label}{r.private ? ' 🔒' : ''}</span>
            <span className={styles.metricVal}>{r.value}</span>
          </div>
        ))}
      </div>

      {/* История снимков */}
      {p.snapshots?.length > 0 && (
        <div className={styles.historyToggle} onClick={() => setExpanded(!expanded)}>
          История записей ({p.snapshots.length}) {expanded ? '▴' : '▾'}
        </div>
      )}
      {expanded && (
        <div className={styles.history}>
          {p.snapshots.map((s, i) => (
            <div key={s.id} className={styles.historyRow}>
              <span className={styles.historyDate}>{s.recorded_at?.slice(0, 10)}</span>
              <span>👁 {fmtNum(s.visits)}</span>
              <span>🛒 {fmtNum(s.cart)}</span>
              <span>✅ {fmtNum(s.orders)}</span>
              {s.note && <span className={styles.note}>{s.note}</span>}
              {isAdmin && (
                <button className={styles.iconBtn + ' ' + styles.del + ' ' + styles.tiny} onClick={() => onDeleteSnapshot(s.id)}>✕</button>
              )}
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
      <Select label="Креатор" value={creatorId} onChange={e => setCreatorId(e.target.value)}>
        {creators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
      <Input label="Название (например: Апрель 2026)" value={label} onChange={e => setLabel(e.target.value)} />
      <Input label="Дата начала" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
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
    <Modal title={`Внести данные — ${period.label}`} onClose={onClose}>
      <p style={{ fontSize: 12, color: 'var(--text3)' }}>Накопительно с {period.date_from} по сегодня</p>
      <Input label="Заходы по артикулу" type="number" placeholder="0" value={visits} onChange={e => setVisits(e.target.value)} />
      <Input label="Положили в корзину" type="number" placeholder="0" value={cart} onChange={e => setCart(e.target.value)} />
      <Input label="Купили (заказы)" type="number" placeholder="0" value={orders} onChange={e => setOrders(e.target.value)} />
      <Input label="Заметка (необязательно)" placeholder="например: данные за 1-7 апр" value={note} onChange={e => setNote(e.target.value)} />
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

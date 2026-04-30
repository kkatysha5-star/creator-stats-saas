import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from '../lib/api.js';
import { fmtNum } from '../lib/utils.js';
import { PageHeader, Avatar, Btn, Input, Select, Modal, Loader, Empty, DatePicker } from '../components/UI.jsx';
import { useAuth } from '../App.jsx';
import styles from './Funnel.module.css';

const PLAN_HAS_FUNNEL = { pro: true };

function FunnelUpgradeWall() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '80px 24px', gap: 16, textAlign: 'center',
    }}>
      <div style={{ width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,106,0,0.1)', borderRadius: 16 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff6a00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      </div>
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
  const { auth } = useAuth();
  const role = auth?.workspaces?.[0]?.role;
  const canEdit = role === 'owner' || role === 'manager';
  const [periods, setPeriods] = useState([]);
  const [privateData, setPrivateData] = useState({});
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
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
      if (canEdit) {
        try {
          const priv = await api.getFunnelPrivate();
          const map = {};
          priv.forEach(p => { map[p.id] = p; });
          setPrivateData(map);
        } catch {}
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [canEdit]);

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

  const allCols = canEdit ? [...COLS, ...ADMIN_COLS] : COLS;

  return (
    <div className={styles.page}>
      <PageHeader title="Воронка продаж" subtitle="Конверсии и продажи по периодам">
        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && (
            <>
              <Btn small onClick={() => setShowImport(true)}>📥 Импорт из Excel</Btn>
              <Btn variant="primary" small onClick={() => setShowNewPeriod(true)}>+ Период</Btn>
            </>
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
        ? <Empty icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>} text="Нет данных за этот период" sub={canEdit ? 'Создайте периоды для креаторов' : 'Данные ещё не внесены'} />
        : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thCreator}>Креатор</th>
                  {allCols.map(c => (
                    <th key={c.key} className={styles.th + (c.private ? ' ' + styles.thPrivate : '')}>{c.label}</th>
                  ))}
                  {canEdit && <th className={styles.th}>Действия</th>}
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
                      {canEdit && ADMIN_COLS.map(c => {
                        const val = priv ? priv[c.key] : null;
                        return (
                          <td key={c.key} className={styles.td + ' ' + styles.tdPrivate}>
                            <span className={styles.tdVal}>{c.fmt(val)}</span>
                          </td>
                        );
                      })}
                      {canEdit && (
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
            <HistoryBlock key={p.id} period={p} canEdit={canEdit} onDelete={async (sid) => {
              if (!confirm('Удалить запись?')) return;
              await api.deleteFunnelSnapshot(sid);
              load();
            }} />
          ))}
        </div>
      )}

      {showImport && <ImportModal creators={creators} onClose={() => setShowImport(false)} onSaved={() => { setShowImport(false); load(); }} />}
      {showNewPeriod && <NewPeriodModal creators={creators} onClose={() => setShowNewPeriod(false)} onSaved={() => { setShowNewPeriod(false); load(); }} />}
      {showSnapshot && <SnapshotModal period={showSnapshot} onClose={() => setShowSnapshot(null)} onSaved={() => { setShowSnapshot(null); load(); }} />}
      {showEdit && <EditPeriodModal period={showEdit} onClose={() => setShowEdit(null)} onSaved={() => { setShowEdit(null); load(); }} />}
    </div>
  );
}

function HistoryBlock({ period: p, canEdit, onDelete }) {
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
              {canEdit && <button className={styles.iconBtn + ' ' + styles.del + ' ' + styles.tiny} onClick={() => onDelete(s.id)}>✕</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Excel / CSV Import ──────────────────────────────────────────────────────

const IMPORT_FIELD_LABELS = {
  creator_name: 'Имя креатора',
  total_views:  'Охват (просмотры)',
  visits:       'Заходы',
  cart:         'Корзина',
  orders:       'Заказы',
  payout:       'Выплата 🔒',
};

const IMPORT_KEYWORDS = {
  creator_name: ['имя', 'name', 'креатор', 'creator', 'автор'],
  total_views:  ['охват', 'view', 'просмотр', 'reach'],
  visits:       ['заход', 'visit', 'визит', 'клик'],
  cart:         ['корзина', 'cart', 'basket'],
  orders:       ['заказ', 'order', 'покупк'],
  payout:       ['выплата', 'payout', 'зп', 'зарплат', 'оплата'],
};

function autoDetectColumns(headers) {
  const res = {};
  for (const [field, kws] of Object.entries(IMPORT_KEYWORDS)) {
    res[field] = headers.find(h => kws.some(kw => h.toLowerCase().includes(kw))) ?? '';
  }
  return res;
}

function normCreatorName(s) { return s.toLowerCase().replace(/\s+/g, ' ').trim(); }

function matchCreator(excelName, creators) {
  const en = normCreatorName(excelName);
  return (
    creators.find(c => normCreatorName(c.name) === en) ||
    creators.find(c => normCreatorName(c.name).includes(en) || en.includes(normCreatorName(c.name))) ||
    null
  );
}

function defaultPeriodLabel() {
  const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const now = new Date();
  return `${months[now.getMonth()]} ${String(now.getFullYear()).slice(2)}`;
}

function ImportModal({ creators, onClose, onSaved }) {
  const fileRef = useRef(null);
  const [step, setStep] = useState(0);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [label, setLabel] = useState(defaultPeriodLabel);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [mapping, setMapping] = useState({ creator_name: '', total_views: '', visits: '', cart: '', orders: '', payout: '' });
  const [creatorMatch, setCreatorMatch] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [dragging, setDragging] = useState(false);

  const parseFile = async (file) => {
    setError('');
    try {
      const XLSX = window.XLSX;
      if (!XLSX) { setError('Библиотека xlsx не загружена. Перезагрузите страницу.'); return; }
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      // Развернуть объединённые ячейки
      (ws['!merges'] || []).forEach(merge => {
        const firstAddr = XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c });
        const firstVal = ws[firstAddr]?.v;
        for (let r = merge.s.r; r <= merge.e.r; r++) {
          for (let c = merge.s.c; c <= merge.e.c; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            if (!ws[addr]) ws[addr] = { v: firstVal, t: typeof firstVal === 'number' ? 'n' : 's' };
          }
        }
      });
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (!raw.length) { setError('Файл пустой'); return; }
      const hdrs = raw[0].map(h => String(h).trim()).filter(Boolean);
      const dataRows = raw.slice(1).filter(r => r.some(c => c !== ''));
      const objs = dataRows.map(r => Object.fromEntries(hdrs.map((h, i) => [h, r[i] ?? ''])));
      setHeaders(hdrs);
      setRows(objs);
      setFileName(file.name);
      const detected = autoDetectColumns(hdrs);
      setMapping(detected);
      rebuildCreatorMatch(objs, detected.creator_name);
      setStep(1);
    } catch (e) {
      setError('Ошибка чтения файла: ' + e.message);
    }
  };

  const rebuildCreatorMatch = (dataRows, creatorCol) => {
    const names = [...new Set(dataRows.map(r => String(r[creatorCol] || '').trim()).filter(Boolean))];
    const matches = {};
    for (const n of names) {
      const m = matchCreator(n, creators);
      matches[n] = m ? String(m.id) : '';
    }
    setCreatorMatch(matches);
  };

  const excelCreatorNames = useMemo(() => {
    if (!mapping.creator_name) return [];
    return [...new Set(rows.map(r => String(r[mapping.creator_name] || '').trim()).filter(Boolean))];
  }, [rows, mapping.creator_name]);

  const matchedCount = excelCreatorNames.filter(n => creatorMatch[n]).length;

  const getInt = (row, col) => {
    if (!col) return undefined;
    const v = row[col];
    if (v === '' || v == null) return undefined;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[\s ]/g, '').replace(',', '.'));
    return isNaN(n) ? undefined : Math.round(n);
  };
  const getFloat = (row, col) => {
    if (!col) return undefined;
    const v = row[col];
    if (v === '' || v == null) return undefined;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[\s ]/g, '').replace(',', '.'));
    return isNaN(n) ? undefined : n;
  };

  const handleImport = async () => {
    if (!label.trim()) return setError('Укажите название периода');
    if (!dateFrom) return setError('Укажите дату начала периода');
    if (!mapping.creator_name) return setError('Выберите колонку с именами креаторов');
    if (!matchedCount) return setError('Нет ни одного сопоставленного креатора');
    const importRows = rows.map(row => {
      const excelName = String(row[mapping.creator_name] || '').trim();
      const creatorId = creatorMatch[excelName];
      if (!creatorId) return null;
      return {
        creator_id: parseInt(creatorId), label: label.trim(),
        date_from: dateFrom, date_to: dateTo || undefined,
        total_views: getInt(row, mapping.total_views),
        visits:      getInt(row, mapping.visits),
        cart:        getInt(row, mapping.cart),
        orders:      getInt(row, mapping.orders),
        payout:      getFloat(row, mapping.payout),
      };
    }).filter(Boolean);
    setLoading(true); setError('');
    try {
      const res = await api.importFunnel(importRows);
      setResults(res.results);
      setStep(2);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const setMappingField = (field, value) => {
    const next = { ...mapping, [field]: value };
    setMapping(next);
    if (field === 'creator_name') rebuildCreatorMatch(rows, value);
  };

  const previewRows = rows.slice(0, 4);
  const mappedCols = Object.entries(mapping).filter(([, v]) => v).map(([k, v]) => ({ field: k, col: v, label: IMPORT_FIELD_LABELS[k] }));

  const dropZoneStyle = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 12, padding: '36px 24px',
    border: `2px dashed ${dragging ? '#ff6a00' : 'var(--border2)'}`,
    borderRadius: 12, cursor: 'pointer',
    background: dragging ? 'rgba(255,106,0,0.06)' : 'var(--bg3)',
    transition: 'all .15s',
  };

  const colSelect = (field) => (
    <select
      style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 6, color: mapping[field] ? 'var(--text)' : 'var(--text3)', fontFamily: 'var(--font)', fontSize: 11, padding: '4px 8px', outline: 'none' }}
      value={mapping[field]} onChange={e => setMappingField(field, e.target.value)}
    >
      <option value="">— не импортировать —</option>
      {headers.map(h => <option key={h} value={h}>{h}</option>)}
    </select>
  );

  // Step 0: Upload
  if (step === 0) return (
    <Modal title="Импорт из Excel / CSV" onClose={onClose} width={480}
      footer={<Btn onClick={onClose}>Отмена</Btn>}
    >
      <p style={{ fontSize: 12, color: 'var(--text3)' }}>
        Загрузите .xlsx или .csv — колонки определятся автоматически.
      </p>
      <div style={dropZoneStyle}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) parseFile(f); }}
        onClick={() => fileRef.current?.click()}
      >
        <span style={{ fontSize: 36 }}>📊</span>
        <span style={{ fontSize: 13, color: 'var(--text2)' }}>Перетащите файл или нажмите для выбора</span>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>.xlsx, .xls, .csv</span>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
          onChange={e => e.target.files[0] && parseFile(e.target.files[0])} />
      </div>
      {error && <p style={{ color: '#ff5050', fontSize: 12 }}>{error}</p>}
    </Modal>
  );

  // Step 2: Done
  if (step === 2) {
    const ok = results?.filter(r => r.ok).length ?? 0;
    const err = results?.filter(r => r.error).length ?? 0;
    return (
      <Modal title="Импорт завершён" onClose={onClose} width={480}
        footer={<Btn variant="primary" onClick={onSaved}>Готово</Btn>}
      >
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, padding: '12px 16px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#4ade80' }}>{ok}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>импортировано</div>
          </div>
          {err > 0 && (
            <div style={{ flex: 1, padding: '12px 16px', background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#f87171' }}>{err}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>ошибок</div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
          {results?.map((r, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px',
              background: r.error ? 'rgba(255,80,80,0.06)' : 'rgba(74,222,128,0.06)',
              border: `1px solid ${r.error ? 'rgba(255,80,80,0.2)' : 'rgba(74,222,128,0.15)'}`,
              borderRadius: 6, fontSize: 12,
            }}>
              <span style={{ color: r.error ? '#f87171' : '#4ade80' }}>{r.error ? '✕' : '✓'}</span>
              <span style={{ color: 'var(--text2)' }}>{r.error ? r.error : `Период «${r.label}» — ID ${r.period_id}`}</span>
            </div>
          ))}
        </div>
      </Modal>
    );
  }

  // Step 1: Map + creators
  return (
    <Modal title={`Настройка импорта — ${fileName}`} onClose={onClose} width={640}
      footer={
        <>
          <Btn onClick={() => setStep(0)}>← Назад</Btn>
          <Btn onClick={onClose}>Отмена</Btn>
          <Btn variant="primary" loading={loading} onClick={handleImport}>
            Импортировать {matchedCount > 0 ? `(${matchedCount})` : ''}
          </Btn>
        </>
      }
    >
      {/* Period config */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 2 }}>
          <Input label="Название периода" placeholder="Апрель 26" value={label} onChange={e => setLabel(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <DatePicker label="Дата начала" value={dateFrom} onChange={v => setDateFrom(v)} />
        </div>
        <div style={{ flex: 1 }}>
          <DatePicker label="Дата конца" value={dateTo} onChange={v => setDateTo(v)} />
        </div>
      </div>

      {/* Column mapping */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>Колонки в файле</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px' }}>
          {Object.keys(IMPORT_FIELD_LABELS).map(field => (
            <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)', width: 96, flexShrink: 0 }}>{IMPORT_FIELD_LABELS[field]}</span>
              {colSelect(field)}
            </div>
          ))}
        </div>
      </div>

      {/* Preview */}
      {previewRows.length > 0 && mappedCols.length > 1 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
            Превью ({previewRows.length} из {rows.length} строк)
          </div>
          <div style={{ overflowX: 'auto', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg2)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {mappedCols.map(c => <th key={c.field} style={{ padding: '5px 10px', textAlign: 'left', color: 'var(--text3)', fontWeight: 600, whiteSpace: 'nowrap' }}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: i < previewRows.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    {mappedCols.map(c => (
                      <td key={c.field} style={{ padding: '4px 10px', color: 'var(--text2)', fontFamily: c.field === 'creator_name' ? 'var(--font)' : 'var(--mono)', whiteSpace: 'nowrap' }}>
                        {String(r[c.col] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Creator matching */}
      {excelCreatorNames.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
            Сопоставление креаторов{' '}
            <span style={{ color: matchedCount === excelCreatorNames.length ? '#4ade80' : '#f59e0b' }}>
              ({matchedCount}/{excelCreatorNames.length})
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {excelCreatorNames.map(n => (
              <div key={n} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px',
                background: 'var(--bg2)',
                border: `1px solid ${creatorMatch[n] ? 'var(--border)' : 'rgba(245,158,11,0.35)'}`,
                borderRadius: 6,
              }}>
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', fontFamily: 'var(--mono)' }}>{n}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>→</span>
                <select
                  style={{ flex: 1.5, background: 'var(--bg3)', border: `1px solid ${creatorMatch[n] ? 'var(--border2)' : 'rgba(245,158,11,0.4)'}`, borderRadius: 6, color: creatorMatch[n] ? 'var(--text)' : 'var(--text3)', fontFamily: 'var(--font)', fontSize: 11, padding: '4px 8px', outline: 'none' }}
                  value={creatorMatch[n] || ''}
                  onChange={e => setCreatorMatch(prev => ({ ...prev, [n]: e.target.value }))}
                >
                  <option value="">— пропустить —</option>
                  {creators.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p style={{ color: '#ff5050', fontSize: 12 }}>{error}</p>}
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
    <Modal title="Новый период" onClose={onClose}
      footer={<><Btn onClick={onClose}>Отмена</Btn><Btn variant="primary" onClick={handleSave} loading={loading}>Создать</Btn></>}
    >
      <p style={{ fontSize: 12, color: 'var(--text3)' }}>Название используется для группировки — у всех креаторов одного месяца оно должно совпадать, например «Апрель 26»</p>
      <Select label="Креатор" value={creatorId} onChange={e => setCreatorId(e.target.value)}>
        {creators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
      <Input label="Название периода" placeholder="Апрель 26" value={label} onChange={e => setLabel(e.target.value)} />
      <DatePicker label="Дата начала работы этого креатора" value={dateFrom} onChange={v => setDateFrom(v)} />
      <DatePicker label="Дата окончания (можно оставить пустой)" value={dateTo} onChange={v => setDateTo(v)} />
      {error && <p style={{ color: '#ff5050', fontSize: 12 }}>{error}</p>}
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
    <Modal title={`Внести данные — ${period.creator_name}, ${period.label}`} onClose={onClose}
      footer={<><Btn onClick={onClose}>Отмена</Btn><Btn variant="primary" onClick={handleSave} loading={loading}>Сохранить</Btn></>}
    >
      <p style={{ fontSize: 12, color: 'var(--text3)' }}>Накопительно с {period.date_from} по сегодня</p>
      <Input label="Заходы по артикулу" type="number" placeholder="0" value={visits} onChange={e => setVisits(e.target.value)} />
      <Input label="Положили в корзину" type="number" placeholder="0" value={cart} onChange={e => setCart(e.target.value)} />
      <Input label="Купили (заказы)" type="number" placeholder="0" value={orders} onChange={e => setOrders(e.target.value)} />
      <Input label="Заметка (необязательно)" placeholder="данные за 1–7 апр" value={note} onChange={e => setNote(e.target.value)} />
      {error && <p style={{ color: '#ff5050', fontSize: 12 }}>{error}</p>}
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
    <Modal title="Редактировать период" onClose={onClose}
      footer={<><Btn onClick={onClose}>Отмена</Btn><Btn variant="primary" onClick={handleSave} loading={loading}>Сохранить</Btn></>}
    >
      <Input label="Название" value={label} onChange={e => setLabel(e.target.value)} />
      <DatePicker label="Дата окончания" value={dateTo} onChange={v => setDateTo(v)} />
      <Input label="Выплата креатору (₽) 🔒" type="number" placeholder="0" value={payout} onChange={e => setPayout(e.target.value)} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
        <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
        Активный период
      </label>
      {error && <p style={{ color: '#ff5050', fontSize: 12 }}>{error}</p>}
    </Modal>
  );
}

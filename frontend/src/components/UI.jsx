import { useState, useEffect, useRef, useCallback } from 'react';
import { platformMeta, getInitials } from '../lib/utils.js';
import styles from './UI.module.css';

// ─── CountUp hook ────────────────────────────────────────────────────────────
function useCountUp(target, duration = 600) {
  const [val, setVal] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (target == null || isNaN(target)) return;
    const from = prev.current;
    prev.current = target;
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target]);
  return val;
}

// ─── Page Header ──────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, children }) {
  return (
    <div className={styles.pageHeader}>
      <div>
        <h1 className={styles.pageTitle}>{title}</h1>
        {subtitle && <p className={styles.pageSub}>{subtitle}</p>}
      </div>
      {children && <div className={styles.pageActions}>{children}</div>}
    </div>
  );
}

// ─── Metric Card ─────────────────────────────────────────────────────────────
export function MetricCard({ label, value, sub, rawValue, onClick, active, delta }) {
  const animated = useCountUp(typeof rawValue === 'number' ? rawValue : null);
  const displayValue = typeof rawValue === 'number'
    ? animated.toLocaleString('ru-RU')
    : value;

  return (
    <div
      className={[styles.metricCard, onClick ? styles.metricClickable : '', active ? styles.metricActive : ''].join(' ')}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{displayValue ?? '—'}</div>
      {delta != null && (
        <div className={delta > 0 ? styles.deltaUp : delta < 0 ? styles.deltaDown : styles.deltaFlat}>
          {delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}%
        </div>
      )}
      {sub && <div className={styles.metricSub}>{sub}</div>}
    </div>
  );
}

// ─── Platform Badge ───────────────────────────────────────────────────────────
export function PlatformBadge({ platform, hasError }) {
  if (hasError) return <span className={styles.badgeError}>⚠ ошибка</span>;
  const colorMap = {
    youtube:   { bg: 'rgba(255,68,68,0.1)',  color: '#ff4444', border: 'rgba(255,68,68,0.25)' },
    tiktok:    { bg: 'rgba(50,205,100,0.1)', color: '#32cd64', border: 'rgba(50,205,100,0.25)' },
    instagram: { bg: 'rgba(255,106,0,0.1)',  color: '#ff6a00', border: 'rgba(255,106,0,0.25)' },
  };
  const { label } = platformMeta(platform);
  const c = colorMap[platform] || { bg: 'rgba(136,136,136,0.1)', color: '#888', border: 'rgba(136,136,136,0.25)' };
  return (
    <span className={styles.badge} style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {label}
    </span>
  );
}

// ─── Platform Dot ─────────────────────────────────────────────────────────────
export function PlatformDot({ platform }) {
  const { color } = platformMeta(platform);
  return <span className={styles.dot} style={{ background: color }} title={platformMeta(platform).label} />;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
export function Avatar({ name, color, size = 32 }) {
  return (
    <div className={styles.avatar} style={{ width: size, height: size, background: color + '22', color, fontSize: size * 0.36, border: `1px solid ${color}44` }}>
      {getInitials(name)}
    </div>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, variant = 'ghost', disabled, loading, small, style }) {
  return (
    <button
      className={[styles.btn, styles[variant], small ? styles.small : ''].join(' ')}
      onClick={onClick}
      disabled={disabled || loading}
      style={style}
    >
      {loading ? <span className={styles.spinner} /> : children}
    </button>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────
export function Input({ label, error, ...props }) {
  return (
    <div className={styles.field}>
      {label && <label className={styles.label}>{label}</label>}
      <input className={styles.input} {...props} />
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────
export function Select({ label, children, ...props }) {
  return (
    <div className={styles.field}>
      {label && <label className={styles.label}>{label}</label>}
      <select className={styles.select} {...props}>{children}</select>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, footer, width = 420, 'data-tour': dataTour }) {
  return (
    <div className={styles.modalBg} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} style={{ width }} data-tour={dataTour}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{title}</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>{children}</div>
        {footer && <div className={styles.modalFooter}>{footer}</div>}
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function Empty({ icon = '📭', text, sub }) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}>{icon}</span>
      <p className={styles.emptyText}>{text}</p>
      {sub && <p className={styles.emptySub}>{sub}</p>}
    </div>
  );
}

// ─── Skeleton Loader ─────────────────────────────────────────────────────────
export function Loader({ type = 'cards', rows = 4 }) {
  if (type === 'spin') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '56px 0' }}>
        <div className={styles.spinnerOrange} />
      </div>
    );
  }
  if (type === 'rows') {
    return (
      <div style={{ padding: '0 28px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={`skeleton-base ${styles.skeletonRow}`} />
        ))}
      </div>
    );
  }
  return (
    <div style={{ padding: '0 28px 28px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`skeleton-base ${styles.skeletonCard}`} />
      ))}
    </div>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────
let _setToast = null;

export function showToast(msg) {
  _setToast?.(msg);
}

export function ToastProvider() {
  const [msg, setMsg] = useState(null);
  _setToast = setMsg;
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2200);
    return () => clearTimeout(t);
  }, [msg]);
  if (!msg) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 100, padding: '9px 18px', fontSize: 13, color: 'var(--text)',
      zIndex: 9999, pointerEvents: 'none', whiteSpace: 'nowrap',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', gap: 8,
      animation: 'fadeUp 150ms ease-out both',
    }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="6.5" stroke="#4ade80" strokeWidth="1.2"/>
        <path d="M4 7l2 2 4-4" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {msg}
    </div>
  );
}

// ─── Circular Progress ───────────────────────────────────────────────────────
export function CircularProgress({ pct = 0, size = 88, stroke = 7, color }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(Math.max(pct, 0), 100);
  const dash = (clamped / 100) * circ;
  const fillColor = color || (clamped >= 70 ? 'var(--color-ok)' : clamped >= 40 ? '#ff6a00' : 'var(--color-bad)');
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" style={{ stroke: 'var(--progress-track)' }} strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" style={{ stroke: fillColor, transition: 'stroke-dasharray 700ms cubic-bezier(.4,0,.2,1)' }} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
export function ProgressBar({ pct, color }) {
  const gradients = {
    good: 'linear-gradient(90deg, #4ade80, #86efac)',
    mid:  'linear-gradient(90deg, #ff6a00, #ffaa60)',
    bad:  'linear-gradient(90deg, #f87171, #fca5a5)',
  };
  const auto = color ? color : (pct >= 70 ? gradients.good : pct >= 40 ? gradients.mid : gradients.bad);
  return (
    <div className={styles.progressTrack}>
      <div className={styles.progressFill} style={{ width: `${Math.min(pct, 100)}%`, background: auto }} />
    </div>
  );
}

// ─── Custom DatePicker ────────────────────────────────────────────────────────
const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAYS_RU = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

export function DatePicker({ value, onChange, placeholder = 'Дата', label }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    if (value) { const d = new Date(value + 'T00:00:00'); return { y: d.getFullYear(), m: d.getMonth() }; }
    const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() };
  });
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync view when value changes externally
  useEffect(() => {
    if (value) { const d = new Date(value + 'T00:00:00'); setView({ y: d.getFullYear(), m: d.getMonth() }); }
  }, [value]);

  const { y, m } = view;
  const firstDayOfWeek = (new Date(y, m, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  const prevMonth = () => setView(v => v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 });
  const nextMonth = () => setView(v => v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 });

  const pick = (d) => {
    const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    onChange(iso);
    setOpen(false);
  };

  const formatDisplay = (iso) => {
    if (!iso) return '';
    const [yr, mo, da] = iso.split('-');
    return `${da}.${mo}.${yr}`;
  };

  const picker = (
    <div ref={ref} className={styles.dpWrap}>
      <button
        className={styles.dpTrigger}
        onClick={() => setOpen(o => !o)}
        type="button"
      >
        <span className={value ? styles.dpValueSet : styles.dpPlaceholder}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.4, flexShrink: 0 }}>
          <rect x="1" y="3" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
          <line x1="4" y1="1" x2="4" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          <line x1="8" y1="1" x2="8" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        {value && (
          <span
            className={styles.dpClear}
            onClick={e => { e.stopPropagation(); onChange(''); }}
          >×</span>
        )}
      </button>

      {open && (
        <div className={styles.dpCalendar}>
          <div className={styles.dpCalHeader}>
            <button className={styles.dpNavBtn} onClick={prevMonth} type="button">‹</button>
            <span className={styles.dpMonthLabel}>{MONTHS_RU[m]} {y}</span>
            <button className={styles.dpNavBtn} onClick={nextMonth} type="button">›</button>
          </div>
          <div className={styles.dpGrid}>
            {DAYS_RU.map(d => <span key={d} className={styles.dpDayName}>{d}</span>)}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => <span key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSel = iso === value;
              const isToday = iso === today;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => pick(day)}
                  className={[
                    styles.dpDay,
                    isSel ? styles.dpDaySelected : '',
                    isToday && !isSel ? styles.dpDayToday : '',
                  ].filter(Boolean).join(' ')}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
  if (label) {
    return (
      <div className={styles.field}>
        <label className={styles.label}>{label}</label>
        {picker}
      </div>
    );
  }
  return picker;
}

// ─── Compare Selector ────────────────────────────────────────────────────────
export const COMPARE_OPTIONS = [
  { value: 'prev_period', label: 'Прошлый период' },
  { value: 'prev_week',   label: 'Прошлая неделя' },
  { value: 'prev_month',  label: 'Прошлый месяц'  },
  { value: 'custom',      label: 'Свой период'    },
  { value: 'off',         label: 'Без сравнения'  },
];

export function CompareSelector({ value, onChange, customFrom = '', customTo = '', onCustomChange }) {
  const selectStyle = {
    background: 'var(--bg3)', border: '1px solid var(--border2)',
    borderRadius: 'var(--radius-pill)', color: value === 'off' ? 'var(--text3)' : 'var(--text2)',
    fontFamily: 'var(--font)', fontSize: '13px', fontWeight: 500,
    padding: '6px 28px 6px 12px', outline: 'none', cursor: 'pointer',
    appearance: 'none', WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23666' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
        Сравнить с
      </span>
      <select value={value} onChange={e => onChange(e.target.value)} style={selectStyle}>
        {COMPARE_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {value === 'custom' && (
        <>
          <DatePicker value={customFrom} onChange={v => onCustomChange?.(v, customTo)} placeholder="С" />
          <span style={{ color: 'var(--text3)', fontSize: 13 }}>—</span>
          <DatePicker value={customTo} onChange={v => onCustomChange?.(customFrom, v)} placeholder="По" />
        </>
      )}
    </div>
  );
}

// ─── Period Tabs ──────────────────────────────────────────────────────────────
export const PERIODS = [
  { id: 'month',     label: 'Этот месяц' },
  { id: 'lastmonth', label: 'Прошлый месяц' },
  { id: 'quarter',   label: 'Квартал' },
  { id: 'all',       label: 'Всё время' },
  { id: 'custom',    label: 'Период...' },
];

export function PeriodTabs({ value, onChange, customFrom, customTo, onCustomChange, onReset }) {
  const canReset = !!onReset && (value !== 'month' || !!customFrom || !!customTo);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <div className={styles.tabs}>
        {PERIODS.map(p => (
          <button key={p.id} className={[styles.tab, value === p.id ? styles.tabActive : ''].join(' ')} onClick={() => onChange(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      {value === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <DatePicker
            value={customFrom || ''}
            onChange={v => onCustomChange?.(v, customTo)}
            placeholder="С"
          />
          <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>
          <DatePicker
            value={customTo || ''}
            onChange={v => onCustomChange?.(customFrom, v)}
            placeholder="По"
          />
        </div>
      )}
      {canReset && (
        <button
          onClick={onReset}
          style={{
            background: 'var(--bg3)',
            border: '1px solid var(--border2)',
            borderRadius: 'var(--radius-pill)',
            color: 'var(--text3)',
            fontFamily: 'var(--font)',
            fontSize: 12,
            fontWeight: 600,
            padding: '6px 12px',
            cursor: 'pointer',
          }}
        >
          Сбросить период
        </button>
      )}
    </div>
  );
}

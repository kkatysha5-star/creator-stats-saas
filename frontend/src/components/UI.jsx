import { useState, useEffect, useRef } from 'react';
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
export function MetricCard({ label, value, sub, rawValue, onClick, active }) {
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
      {sub && <div className={styles.metricSub}>{sub}</div>}
    </div>
  );
}

// ─── Platform Badge ───────────────────────────────────────────────────────────
export function PlatformBadge({ platform, hasError }) {
  if (hasError) {
    return (
      <span className={styles.badgeError}>⚠ ошибка</span>
    );
  }
  const { label, color } = platformMeta(platform);
  const colorMap = {
    youtube:   { bg: 'rgba(255,68,68,0.1)',   color: '#ff4444', border: 'rgba(255,68,68,0.25)' },
    tiktok:    { bg: 'rgba(50,205,100,0.1)',  color: '#32cd64', border: 'rgba(50,205,100,0.25)' },
    instagram: { bg: 'rgba(255,106,0,0.1)',   color: '#ff6a00', border: 'rgba(255,106,0,0.25)' },
  };
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
export function Modal({ title, onClose, children, width = 420 }) {
  return (
    <div className={styles.modalBg} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} style={{ width }}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{title}</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>{children}</div>
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

// ─── Progress Bar ─────────────────────────────────────────────────────────────
export function ProgressBar({ pct, color }) {
  const gradients = {
    good:     'linear-gradient(90deg, #4ade80, #86efac)',
    mid:      'linear-gradient(90deg, #ff6a00, #ffaa60)',
    bad:      'linear-gradient(90deg, #f87171, #fca5a5)',
  };
  const auto = color ? color : (pct >= 70 ? gradients.good : pct >= 40 ? gradients.mid : gradients.bad);
  return (
    <div className={styles.progressTrack}>
      <div className={styles.progressFill} style={{ width: `${Math.min(pct, 100)}%`, background: auto }} />
    </div>
  );
}

// ─── Period Tabs ──────────────────────────────────────────────────────────────
export const PERIODS = [
  { id: 'month', label: 'Этот месяц' },
  { id: 'lastmonth', label: 'Прошлый месяц' },
  { id: 'quarter', label: 'Квартал' },
  { id: 'all', label: 'Всё время' },
  { id: 'custom', label: 'Период...' },
];

export function PeriodTabs({ value, onChange, customFrom, customTo, onCustomChange }) {
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
          <input
            type="date"
            value={customFrom || ''}
            onChange={e => onCustomChange?.(e.target.value, customTo)}
            className={styles.dateInput}
          />
          <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>
          <input
            type="date"
            value={customTo || ''}
            onChange={e => onCustomChange?.(customFrom, e.target.value)}
            className={styles.dateInput}
          />
        </div>
      )}
    </div>
  );
}

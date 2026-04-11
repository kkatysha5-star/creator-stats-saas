import { platformMeta, getInitials, fmtNum } from '../lib/utils.js';
import styles from './UI.module.css';

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
export function MetricCard({ label, value, sub, accent }) {
  return (
    <div className={styles.metricCard} style={accent ? { borderColor: accent + '33' } : {}}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value ?? '—'}</div>
      {sub && <div className={styles.metricSub}>{sub}</div>}
    </div>
  );
}

// ─── Platform Badge ───────────────────────────────────────────────────────────
export function PlatformBadge({ platform }) {
  const { label, color } = platformMeta(platform);
  return (
    <span className={styles.badge} style={{ color, background: color + '18', border: `1px solid ${color}28` }}>
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
    <div className={styles.avatar} style={{ width: size, height: size, background: color + '28', color, fontSize: size * 0.35, border: `1px solid ${color}44` }}>
      {getInitials(name)}
    </div>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, variant = 'ghost', disabled, loading, small }) {
  return (
    <button
      className={[styles.btn, styles[variant], small ? styles.small : ''].join(' ')}
      onClick={onClick}
      disabled={disabled || loading}
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
export function Modal({ title, onClose, children, width = 400 }) {
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

// ─── Loader ───────────────────────────────────────────────────────────────────
export function Loader() {
  return <div className={styles.loaderWrap}><span className={styles.spinner} /></div>;
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
            style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 12, padding: '5px 8px', outline: 'none' }}
          />
          <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>
          <input
            type="date"
            value={customTo || ''}
            onChange={e => onCustomChange?.(customFrom, e.target.value)}
            style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 12, padding: '5px 8px', outline: 'none' }}
          />
        </div>
      )}
    </div>
  );
}

export function fmtNum(n) {
  if (n == null) return '—';
  return n.toLocaleString('ru-RU');
}

export function fmtEr(er) {
  if (er == null) return '—';
  return parseFloat(er).toFixed(2) + '%';
}

export function platformMeta(platform) {
  return {
    youtube:   { label: 'YouTube',   color: '#ff4444', short: 'YT' },
    tiktok:    { label: 'TikTok',    color: '#32cd64', short: 'TT' },
    instagram: { label: 'Instagram', color: '#ff6a00', short: 'IG' },
  }[platform] || { label: platform, color: '#888', short: '?' };
}

export function getInitials(name) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function isoDate(d) { return d.toISOString().split('T')[0]; }

// Возвращает даты предыдущего аналогичного периода для сравнения
export function periodToPrevDates(period) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  if (period === 'month') {
    return { from: isoDate(new Date(y, m - 1, 1)), to: isoDate(new Date(y, m, 0)) };
  }
  if (period === 'lastmonth') {
    return { from: isoDate(new Date(y, m - 2, 1)), to: isoDate(new Date(y, m - 1, 0)) };
  }
  if (period === 'quarter') {
    const q = Math.floor(m / 3);
    const pq = q - 1 < 0 ? 3 : q - 1;
    const py = q - 1 < 0 ? y - 1 : y;
    return { from: isoDate(new Date(py, pq * 3, 1)), to: isoDate(new Date(py, pq * 3 + 3, 0)) };
  }
  return null;
}

// compareMode: 'off' | 'prev_week' | 'prev_month' | 'prev_period' | 'custom'
// Возвращает диапазон дат для сравнения относительно начала текущего периода
export function getCompareDates(compareMode, period, customFrom, customTo, compareCustomFrom, compareCustomTo) {
  if (!compareMode || compareMode === 'off') return null;

  if (compareMode === 'custom') {
    if (!compareCustomFrom && !compareCustomTo) return null;
    return { from: compareCustomFrom || undefined, to: compareCustomTo || undefined };
  }

  if (compareMode === 'prev_period') {
    return periodToPrevDates(period);
  }

  // Для prev_week и prev_month считаем от начала текущего периода
  const current = periodToDates(period, customFrom, customTo);
  const startStr = current.from;
  if (!startStr) return null;
  const start = new Date(startStr + 'T00:00:00');

  if (compareMode === 'prev_week') {
    const to = new Date(start);
    to.setDate(to.getDate() - 1);          // день перед периодом
    const from = new Date(to);
    from.setDate(from.getDate() - 6);       // 7 дней назад от этой точки
    return { from: isoDate(from), to: isoDate(to) };
  }

  if (compareMode === 'prev_month') {
    const y = start.getFullYear();
    const m = start.getMonth();
    return { from: isoDate(new Date(y, m - 1, 1)), to: isoDate(new Date(y, m, 0)) };
  }

  return null;
}

export function calcDelta(curr, prev) {
  if (curr == null || prev == null || prev === 0) return null;
  return (curr - prev) / prev * 100;
}

// Цвет выполнения плана — НЕ красный/оранжевый (они зарезервированы для падений)
export function planColor(pct) {
  if (pct >= 70) return '#4ade80';  // зелёный — хорошо
  if (pct >= 40) return '#38bdf8';  // голубой — идём
  return '#94a3b8';                  // серый — начало пути
}

export function periodToDates(period, customFrom, customTo) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  if (period === 'month') {
    return { from: new Date(y, m, 1).toISOString().split('T')[0], to: new Date(y, m + 1, 0).toISOString().split('T')[0] };
  }
  if (period === 'lastmonth') {
    return { from: new Date(y, m - 1, 1).toISOString().split('T')[0], to: new Date(y, m, 0).toISOString().split('T')[0] };
  }
  if (period === 'quarter') {
    const q = Math.floor(m / 3);
    return { from: new Date(y, q * 3, 1).toISOString().split('T')[0], to: new Date(y, q * 3 + 3, 0).toISOString().split('T')[0] };
  }
  if (period === 'custom') {
    return { from: customFrom || undefined, to: customTo || undefined };
  }
  return {}; // all time
}

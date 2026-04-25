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

// Возвращает даты предыдущего аналогичного периода для сравнения
export function periodToPrevDates(period) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  if (period === 'month') {
    return { from: new Date(y, m - 1, 1).toISOString().split('T')[0], to: new Date(y, m, 0).toISOString().split('T')[0] };
  }
  if (period === 'lastmonth') {
    return { from: new Date(y, m - 2, 1).toISOString().split('T')[0], to: new Date(y, m - 1, 0).toISOString().split('T')[0] };
  }
  if (period === 'quarter') {
    const q = Math.floor(m / 3);
    const pq = q - 1 < 0 ? 3 : q - 1;
    const py = q - 1 < 0 ? y - 1 : y;
    return { from: new Date(py, pq * 3, 1).toISOString().split('T')[0], to: new Date(py, pq * 3 + 3, 0).toISOString().split('T')[0] };
  }
  return null;
}

export function calcDelta(curr, prev) {
  if (curr == null || prev == null || prev === 0) return null;
  return (curr - prev) / prev * 100;
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

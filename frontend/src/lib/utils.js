export function fmtNum(n) {
  if (n == null) return '—';
  // Используем тонкий пробел (U+202F) вместо неразрывного — он не растягивается
  return n.toLocaleString('ru-RU').replace(/\u00A0/g, '\u202F');
}

export function fmtEr(er) {
  if (er == null) return '—';
  return parseFloat(er).toFixed(2) + '%';
}

export function platformMeta(platform) {
  return {
    youtube: { label: 'YouTube', color: '#FF4444', short: 'YT' },
    tiktok:  { label: 'TikTok',  color: '#69C9D0', short: 'TT' },
    instagram: { label: 'Instagram', color: '#E1306C', short: 'IG' },
  }[platform] || { label: platform, color: '#888', short: '?' };
}

export function getInitials(name) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
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

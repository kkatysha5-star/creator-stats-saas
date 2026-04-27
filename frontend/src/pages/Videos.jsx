import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';
import { fmtNum, fmtEr, platformMeta, periodToDates } from '../lib/utils.js';
import {
  PageHeader, PeriodTabs, PlatformBadge, Avatar, Btn, Input, Select,
  Modal, Loader, Empty, DatePicker
} from '../components/UI.jsx';
import styles from './Videos.module.css';

const SORTS = [
  { id: 'date', label: 'По дате' },
  { id: 'views', label: 'По просмотрам' },
  { id: 'er', label: 'По ER' },
  { id: 'likes', label: 'По лайкам' },
];

export default function Videos() {
  const [period, setPeriod] = useState('month');
  const [platform, setPlatform] = useState('');
  const [creatorId, setCreatorId] = useState('');
  const [sort, setSort] = useState('date');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [videos, setVideos] = useState([]);
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [refreshingId, setRefreshingId] = useState(null);
  const [refreshErrors, setRefreshErrors] = useState({});

  const load = useCallback(async () => {
    if (period === 'custom' && !customFrom && !customTo) return;
    setLoading(true);
    try {
      const dates = periodToDates(period, customFrom, customTo);
      const [vids, crs] = await Promise.all([
        api.getVideos({ ...dates, platform: platform || undefined, creator_id: creatorId || undefined }),
        api.getCreators(),
      ]);
      setVideos(vids);
      setCreators(crs);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [period, platform, creatorId, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);

  const sorted = [...videos].sort((a, b) => {
    if (sort === 'views') return (b.views || 0) - (a.views || 0);
    if (sort === 'er') return (b.er || 0) - (a.er || 0);
    if (sort === 'likes') return (b.likes || 0) - (a.likes || 0);
    return (b.published_at || b.added_at || '').localeCompare(a.published_at || a.added_at || '');
  });

  const handleRefresh = async (id) => {
    setRefreshingId(id);
    setRefreshErrors(prev => ({ ...prev, [id]: null }));
    try {
      await api.refreshVideo(id);
      await load();
    } catch (e) {
      setRefreshErrors(prev => ({ ...prev, [id]: e.message }));
    } finally {
      setRefreshingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Удалить видео?')) return;
    await api.deleteVideo(id);
    setVideos(v => v.filter(x => x.id !== id));
  };

  return (
    <div className={styles.page}>
      <PageHeader title="Видео" subtitle={`${sorted.length} роликов за выбранный период`}>
        <span data-tour="add-video"><Btn variant="primary" onClick={() => setShowAdd(true)}>+ Добавить видео</Btn></span>
      </PageHeader>

      <div className={styles.toolbar}>
        <PeriodTabs value={period} onChange={setPeriod} customFrom={customFrom} customTo={customTo} onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }} />
        <select className={styles.filterSelect} value={platform} onChange={e => setPlatform(e.target.value)}>
          <option value="">Все платформы</option>
          <option value="youtube">YouTube</option>
          <option value="tiktok">TikTok</option>
          <option value="instagram">Instagram</option>
        </select>
        <select className={styles.filterSelect} value={creatorId} onChange={e => setCreatorId(e.target.value)}>
          <option value="">Все креаторы</option>
          {creators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className={styles.filterSelect} value={sort} onChange={e => setSort(e.target.value)}>
          {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      {loading ? <Loader /> : sorted.length === 0
        ? <Empty icon="🎬" text="Нет видео за выбранный период" sub="Добавьте ролики по ссылке или измените фильтры" />
        : (
          <div className={styles.tableWrap + ' fade-in'} data-tour="videos-list">
            <div className={styles.tableHead}>
              <span>Видео</span>
              <span>Платформа</span>
              <span>Дата</span>
              <span>Просмотры</span>
              <span>Лайки</span>
              <span>Коммент.</span>
              <span>Репосты</span>
              <span>ER</span>
              <span>Обновлено</span>
              <span></span>
            </div>
            {sorted.map(v => (
              <VideoRow
                key={v.id}
                video={v}
                refreshing={refreshingId === v.id}
                refreshError={refreshErrors[v.id]}
                onRefresh={() => handleRefresh(v.id)}
                onDelete={() => handleDelete(v.id)}
              />
            ))}
          </div>
        )
      }

      {showAdd && (
        <AddVideoModal
          creators={creators}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            load();
            window.dispatchEvent(new CustomEvent('tour:video-added'));
          }}
        />
      )}
    </div>
  );
}

function VideoRow({ video: v, refreshing, refreshError, onRefresh, onDelete }) {
  const statsUpdated = v.stats_updated_at
    ? new Date(v.stats_updated_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <>
      {/* Десктопная строка */}
      <div className={styles.row}>
        <div className={styles.titleCell}>
          <Avatar name={v.creator_name} color={v.avatar_color} size={26} />
          <div className={styles.titleInfo}>
            <a href={v.url} target="_blank" rel="noopener noreferrer" className={styles.videoTitle}>
              {v.title || v.url}
            </a>
            <span className={styles.creatorName}>{v.creator_name}</span>
          </div>
        </div>
        <PlatformBadge platform={v.platform} />
        <span className={styles.date}>{v.published_at || '—'}</span>
        <span className={styles.mono}>{fmtNum(v.views)}</span>
        <span className={styles.mono}>{fmtNum(v.likes)}</span>
        <span className={styles.mono}>{fmtNum(v.comments)}</span>
        <span className={styles.mono}>{v.shares != null ? fmtNum(v.shares) : <span className={styles.na}>—</span>}</span>
        <span className={[styles.mono, styles.erVal].join(' ')}>{fmtEr(v.er)}</span>
        <span className={styles.date}>{statsUpdated}</span>
        <div className={styles.actions}>
          <button className={styles.iconBtn} onClick={onRefresh} disabled={refreshing} title="Обновить статистику">
            {refreshing ? '…' : '↻'}
          </button>
          <button className={styles.iconBtn + ' ' + styles.del} onClick={onDelete} title="Удалить">✕</button>
        </div>
      </div>
      {refreshError && (
        <div className={styles.refreshError}>{refreshError}</div>
      )}

      {/* Мобильная карточка */}
      <div className={styles.mobileRow}>
        <div className={styles.mobileTop}>
          <Avatar name={v.creator_name} color={v.avatar_color} size={30} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <a href={v.url} target="_blank" rel="noopener noreferrer" className={styles.mobileTitle}>
              {v.title || v.url}
            </a>
            <div className={styles.mobileCreator}>{v.creator_name}</div>
          </div>
        </div>
        <div className={styles.mobileMeta}>
          <PlatformBadge platform={v.platform} />
          <span className={styles.date}>{v.published_at || '—'}</span>
        </div>
        <div className={styles.mobileStats}>
          <div className={styles.mobileStat}>
            <span className={styles.mobileStatLabel}>Просм.</span>
            <span className={styles.mobileStatVal}>{fmtNum(v.views)}</span>
          </div>
          <div className={styles.mobileStat}>
            <span className={styles.mobileStatLabel}>Лайки</span>
            <span className={styles.mobileStatVal}>{fmtNum(v.likes)}</span>
          </div>
          <div className={styles.mobileStat}>
            <span className={styles.mobileStatLabel}>Комм.</span>
            <span className={styles.mobileStatVal}>{fmtNum(v.comments)}</span>
          </div>
          <div className={styles.mobileStat}>
            <span className={styles.mobileStatLabel}>ER</span>
            <span className={styles.mobileStatVal + ' ' + styles.accent}>{fmtEr(v.er)}</span>
          </div>
        </div>
        <div className={styles.mobileActions}>
          <button className={styles.iconBtn} onClick={onRefresh} disabled={refreshing} title="Обновить">
            {refreshing ? '…' : '↻'}
          </button>
          <button className={styles.iconBtn + ' ' + styles.del} onClick={onDelete} title="Удалить">✕</button>
        </div>
      </div>
    </>
  );
}

function AddVideoModal({ creators, onClose, onSaved }) {
  const [url, setUrl] = useState('');
  const [creatorId, setCreatorId] = useState(creators[0]?.id || '');
  const [publishedAt, setPublishedAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!url.trim()) return setError('Вставьте ссылку на видео');
    if (!creatorId) return setError('Выберите креатора');
    setError('');
    setLoading(true);
    try {
      await api.addVideo({ url: url.trim(), creator_id: parseInt(creatorId), published_at: publishedAt || undefined });
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Добавить видео" onClose={onClose} data-tour="video-modal">
      <Input
        label="Ссылка на видео (YouTube / TikTok / Instagram)"
        placeholder="https://youtube.com/watch?v=..."
        value={url}
        onChange={e => setUrl(e.target.value)}
      />
      <Select label="Креатор" value={creatorId} onChange={e => setCreatorId(e.target.value)}>
        {creators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
      <DatePicker
        label="Дата публикации (необязательно — подтянется из API)"
        value={publishedAt}
        onChange={v => setPublishedAt(v)}
        placeholder="дд.мм.гггг"
      />
      {error && <p style={{ color: '#ff5050', fontSize: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <Btn onClick={onClose}>Отмена</Btn>
        <Btn variant="primary" onClick={handleSave} loading={loading}>Добавить</Btn>
      </div>
    </Modal>
  );
}


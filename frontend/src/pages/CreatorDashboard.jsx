import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fmtNum, fmtEr, platformMeta, periodToDates, getCompareDates, calcDelta } from '../lib/utils.js';
import { PageHeader, MetricCard, PeriodTabs, PlatformDot, Avatar, Btn, Input, Select, Modal, Loader, Empty, PlatformBadge } from '../components/UI.jsx';
import styles from './CreatorDashboard.module.css';

export default function CreatorDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [period, setPeriod] = useState('month');
  const [compareWith, setCompareWith] = useState('prev_period');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [creator, setCreator] = useState(null);
  const [summaryByPlat, setSummaryByPlat] = useState({});
  const [prevSummaryByPlat, setPrevSummaryByPlat] = useState({});
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (period === 'custom' && !customFrom && !customTo) return;
    setLoading(true);
    try {
      const dates = periodToDates(period, customFrom, customTo);
      const prevDates = getCompareDates(compareWith, period, customFrom, customTo);
      const requests = [
        api.getCreators(),
        api.getSummary({ ...dates, platform: 'youtube',   creator_id: id }),
        api.getSummary({ ...dates, platform: 'tiktok',    creator_id: id }),
        api.getSummary({ ...dates, platform: 'instagram', creator_id: id }),
        api.getVideos({ ...dates, creator_id: id }),
      ];
      if (prevDates) {
        requests.push(
          api.getSummary({ ...prevDates, platform: 'youtube',   creator_id: id }),
          api.getSummary({ ...prevDates, platform: 'tiktok',    creator_id: id }),
          api.getSummary({ ...prevDates, platform: 'instagram', creator_id: id }),
        );
      }
      const results = await Promise.all(requests);
      const [creators, ytRes, ttRes, igRes, vids] = results;
      const found = creators.find(c => String(c.id) === String(id));
      setCreator(found || null);
      setSummaryByPlat({ youtube: ytRes, tiktok: ttRes, instagram: igRes });
      setVideos(vids);
      if (prevDates) {
        const [,,,, , pYt, pTt, pIg] = results;
        setPrevSummaryByPlat({ youtube: pYt, tiktok: pTt, instagram: pIg });
      } else {
        setPrevSummaryByPlat({});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id, period, customFrom, customTo, compareWith]);

  useEffect(() => { load(); }, [load]);

  const sum = (key) => ['youtube','tiktok','instagram'].reduce((s, p) => s + (summaryByPlat[p]?.[key] || 0), 0);
  const prevSum = (key) => ['youtube','tiktok','instagram'].reduce((s, p) => s + (prevSummaryByPlat[p]?.[key] || 0), 0);
  const hasPrev = ['youtube','tiktok','instagram'].some(p => (Number(prevSummaryByPlat[p]?.total_views) || 0) > 0);

  const allViews     = sum('total_views');
  const totalLikes   = sum('total_likes');
  const totalComments= sum('total_comments');
  const totalShares  = sum('total_shares');
  const totalVideos  = sum('total_videos');
  const avgEr = allViews > 0 ? ((totalLikes + totalComments) / allViews * 100) : 0;

  const prevViews    = prevSum('total_views');
  const prevLikes    = prevSum('total_likes');
  const prevComments = prevSum('total_comments');
  const prevShares   = prevSum('total_shares');
  const prevAvgEr    = prevViews > 0 ? ((prevLikes + prevComments) / prevViews * 100) : 0;

  // Планы
  const monthVideoPlan = creator
    ? (creator.video_plan_period === 'week' ? (creator.video_plan_count || 0) * 4 : (creator.video_plan_count || 0))
    : 0;
  const totalUniqueVideos = videos.filter((v, i, arr) =>
    v.post_id ? arr.findIndex(x => x.post_id === v.post_id) === i : true
  ).length;
  const videoPct = monthVideoPlan > 0 ? Math.min(Math.round(totalUniqueVideos / monthVideoPlan * 100), 100) : null;
  const reachPct = creator?.reach_plan > 0 ? Math.min(Math.round(allViews / creator.reach_plan * 100), 100) : null;

  const [showAllVideos, setShowAllVideos] = useState(false);
  const [videoSort, setVideoSort] = useState('views');
  const [refreshingIds, setRefreshingIds] = useState(new Set());
  const [refreshErrors, setRefreshErrors] = useState({});
  const [showAddVideo, setShowAddVideo] = useState(false);

  // Топ видео по просмотрам
  const sortedVideos = [...videos].sort((a, b) => {
    if (videoSort === 'views') return (b.views || 0) - (a.views || 0);
    if (videoSort === 'er') return (b.er || 0) - (a.er || 0);
    if (videoSort === 'date') return (b.published_at || '').localeCompare(a.published_at || '');
    return 0;
  });
  const topVideos = sortedVideos.slice(0, 5);
  const allVideos = sortedVideos;

  const handleRefreshVideo = async (videoId) => {
    setRefreshingIds(prev => new Set([...prev, videoId]));
    setRefreshErrors(prev => ({ ...prev, [videoId]: null }));
    try {
      await api.refreshVideo(videoId);
      await load();
    } catch (e) {
      setRefreshErrors(prev => ({ ...prev, [videoId]: e.message }));
    } finally {
      setRefreshingIds(prev => { const s = new Set(prev); s.delete(videoId); return s; });
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title={
          <div className={styles.titleRow}>
            <button className={styles.backBtn} onClick={() => navigate('/')}>←</button>
            {creator && <Avatar name={creator.name} color={creator.avatar_color} size={32} />}
            <span>{creator?.name || 'Креатор'}</span>
          </div>
        }
        subtitle="Персональная статистика"
      >
        <Btn variant="primary" onClick={() => setShowAddVideo(true)}>+ Добавить ролик</Btn>
      </PageHeader>

      <div className={styles.toolbar}>
        <PeriodTabs value={period} onChange={setPeriod} customFrom={customFrom} customTo={customTo} onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }} />
        <CompareSelect value={compareWith} onChange={setCompareWith} />
      </div>

      {loading ? <Loader /> : (
        <div className="fade-in">

          {/* Метрики */}
          <div className={styles.metrics}>
            <MetricCard label="Просмотры"   rawValue={allViews}     value={fmtNum(allViews)}      sub={`${totalVideos} роликов`} delta={hasPrev ? calcDelta(allViews, prevViews) : null} />
            <MetricCard label="Лайки"       rawValue={totalLikes}   value={fmtNum(totalLikes)}     delta={hasPrev ? calcDelta(totalLikes, prevLikes) : null} />
            <MetricCard label="Комментарии" rawValue={totalComments}value={fmtNum(totalComments)}  delta={hasPrev ? calcDelta(totalComments, prevComments) : null} />
            <MetricCard label="Репосты"     rawValue={totalShares}  value={fmtNum(totalShares)}    delta={hasPrev ? calcDelta(totalShares, prevShares) : null} />
            <MetricCard label="Средний ER"  value={fmtEr(avgEr)}                                   delta={hasPrev ? calcDelta(avgEr, prevAvgEr) : null} />
          </div>

          {/* Планы */}
          {(videoPct !== null || reachPct !== null) && (
            <div style={{ padding: '0 28px 20px', display: 'flex', gap: 10 }}>
              {videoPct !== null && (
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>🎬 Ролики план/факт</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.5px' }}>
                    {totalUniqueVideos} / {monthVideoPlan}
                  </div>
                  <div style={{ marginTop: 8, height: 4, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: videoPct + '%', background: videoPct >= 100 ? '#4ade80' : videoPct >= 70 ? '#f59e0b' : 'var(--accent)', borderRadius: 2, transition: 'width .4s' }} />
                  </div>
                  <div style={{ fontSize: 11, color: videoPct >= 100 ? '#4ade80' : videoPct >= 70 ? '#f59e0b' : 'var(--text3)', marginTop: 4 }}>
                    {videoPct}% выполнения
                  </div>
                </div>
              )}
              {reachPct !== null && (
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>👁 Охваты план/факт</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.5px' }}>
                    {fmtNum(allViews)} / {fmtNum(creator.reach_plan)}
                  </div>
                  <div style={{ marginTop: 8, height: 4, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: reachPct + '%', background: reachPct >= 100 ? '#4ade80' : reachPct >= 70 ? '#f59e0b' : 'var(--accent)', borderRadius: 2, transition: 'width .4s' }} />
                  </div>
                  <div style={{ fontSize: 11, color: reachPct >= 100 ? '#4ade80' : reachPct >= 70 ? '#f59e0b' : 'var(--text3)', marginTop: 4 }}>
                    {reachPct}% выполнения
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Разбивка по платформам */}
          {allViews > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Разбивка по платформам</h2>
              <div className={styles.platGrid}>
                {['youtube', 'tiktok', 'instagram'].map(p => {
                  const { label, color } = platformMeta(p);
                  const s = summaryByPlat[p] || {};
                  const views = s.total_views || 0;
                  const pct = allViews > 0 ? Math.round(views / allViews * 100) : 0;
                  const er = s.avg_er ? parseFloat(s.avg_er).toFixed(2) + '%' : '—';
                  if (!views) return null;
                  return (
                    <div key={p} className={styles.platCard}>
                      <div className={styles.platCardHeader}>
                        <span style={{ color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <PlatformDot platform={p} /> {label}
                        </span>
                        <span className={styles.pct}>{pct}%</span>
                      </div>
                      <div className={styles.platBar}>
                        <div className={styles.platBarFill} style={{ width: pct + '%', background: color }} />
                      </div>
                      <div className={styles.platStats}>
                        <PlatStat label="Просмотры" value={fmtNum(views)} />
                        <PlatStat label="Лайки" value={fmtNum(s.total_likes)} />
                        <PlatStat label="Комм." value={fmtNum(s.total_comments)} />
                        <PlatStat label="ER" value={er} accent />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}



          {/* Все ролики */}
          {videos.length > 0 && (
            <div className={styles.section}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 className={styles.sectionTitle}>Все ролики ({videos.length})</h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    value={videoSort}
                    onChange={e => setVideoSort(e.target.value)}
                    style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--text2)', fontFamily: 'var(--font)', fontSize: 12, padding: '4px 8px', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="views">По просмотрам</option>
                    <option value="er">По ER</option>
                    <option value="date">По дате</option>
                  </select>
                  <button
                    onClick={() => setShowAllVideos(!showAllVideos)}
                    style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--text2)', fontFamily: 'var(--font)', fontSize: 12, padding: '4px 10px', cursor: 'pointer' }}
                  >
                    {showAllVideos ? 'Свернуть' : 'Показать все'}
                  </button>
                </div>
              </div>
              <div className={styles.topVideos}>
                {(showAllVideos ? allVideos : allVideos.slice(0, 5)).map((v, i) => (
                  <div key={v.id} className={styles.videoRow}>
                    <span className={styles.rank}>#{i + 1}</span>
                    <PlatformBadge platform={v.platform} />
                    <a href={v.url} target="_blank" rel="noopener noreferrer" className={styles.videoTitle}>
                      {v.title || v.url}
                    </a>
                    {v.last_error && (
                      <span title={v.last_error} style={{ color: '#ef4444', fontSize: 13, cursor: 'help', flexShrink: 0 }}>⚠</span>
                    )}
                    <div className={styles.videoStats}>
                      <VStat label="Просм." value={fmtNum(v.views)} />
                      <VStat label="Лайки" value={fmtNum(v.likes)} />
                      <VStat label="ER" value={fmtEr(v.er)} accent />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      <button
                        onClick={() => handleRefreshVideo(v.id)}
                        disabled={refreshingIds.has(v.id)}
                        title="Обновить статистику"
                        style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--text3)', fontSize: 13, padding: '2px 7px', cursor: 'pointer', opacity: refreshingIds.has(v.id) ? 0.5 : 1 }}
                      >
                        {refreshingIds.has(v.id) ? '…' : '↻'}
                      </button>
                      {refreshErrors[v.id] && (
                        <span style={{ fontSize: 10, color: '#f87171', maxWidth: 120, textAlign: 'right' }}>{refreshErrors[v.id]}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {!showAllVideos && videos.length > 5 && (
                <button
                  onClick={() => setShowAllVideos(true)}
                  style={{ width: '100%', marginTop: 8, padding: '8px', background: 'transparent', border: '1px dashed var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--text3)', fontFamily: 'var(--font)', fontSize: 12, cursor: 'pointer' }}
                >
                  Показать ещё {videos.length - 5} роликов ▾
                </button>
              )}
            </div>
          )}

          {allViews === 0 && <Empty icon="📊" text="Нет данных за выбранный период" sub="Попробуйте выбрать другой период или добавьте ролик" />}
        </div>
      )}

      {showAddVideo && creator && (
        <AddVideoModal
          creatorId={creator.id}
          creatorName={creator.name}
          onClose={() => setShowAddVideo(false)}
          onSaved={() => { setShowAddVideo(false); load(); }}
        />
      )}
    </div>
  );
}

function AddVideoModal({ creatorId, creatorName, onClose, onSaved }) {
  const [url, setUrl] = useState('');
  const [publishedAt, setPublishedAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!url.trim()) return setError('Вставьте ссылку');
    setLoading(true);
    try {
      await api.createPost({ url: url.trim(), creator_id: creatorId, published_at: publishedAt || undefined });
      onSaved();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal title={`Новый ролик — ${creatorName}`} onClose={onClose}>
      <p style={{ fontSize: 12, color: 'var(--text3)' }}>Добавьте ссылку на ролик — название подтянется автоматически.</p>
      <Input label="Ссылка (YouTube / TikTok / Instagram)" placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} />
      <Input label="Дата публикации (необязательно)" type="date" value={publishedAt} onChange={e => setPublishedAt(e.target.value)} />
      {error && <p style={{ color: '#ff5050', fontSize: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn onClick={onClose}>Отмена</Btn>
        <Btn variant="primary" onClick={handleSave} loading={loading}>Добавить</Btn>
      </div>
    </Modal>
  );
}

const COMPARE_OPTIONS_CD = [
  { value: 'prev_period', label: 'Прошлый период' },
  { value: 'prev_week',   label: 'Прошлая неделя' },
  { value: 'prev_month',  label: 'Прошлый месяц'  },
  { value: 'off',         label: 'Без сравнения'  },
];

function CompareSelect({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>vs</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background: 'var(--bg3)', border: '1px solid var(--border2)',
          borderRadius: 'var(--radius-pill)', color: value === 'off' ? 'var(--text3)' : 'var(--text2)',
          fontFamily: 'var(--font)', fontSize: '12.5px', fontWeight: 500,
          padding: '5px 28px 5px 12px', outline: 'none', cursor: 'pointer',
          appearance: 'none', WebkitAppearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23666' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
        }}
      >
        {COMPARE_OPTIONS_CD.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function PlatStat({ label, value, accent }) {
  return (
    <div className={styles.platStatItem}>
      <span className={styles.platStatLabel}>{label}</span>
      <span className={styles.platStatVal + (accent ? ' ' + styles.accent : '')}>{value || '—'}</span>
    </div>
  );
}

function VStat({ label, value, accent }) {
  return (
    <span className={styles.vstat}>
      <span className={styles.vstatLabel}>{label}</span>
      <span className={styles.vstatVal + (accent ? ' ' + styles.accent : '')}>{value}</span>
    </span>
  );
}

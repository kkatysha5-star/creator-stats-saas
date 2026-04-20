import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fmtNum, fmtEr, platformMeta, periodToDates } from '../lib/utils.js';
import { PageHeader, MetricCard, PeriodTabs, PlatformDot, Avatar, Btn, Loader, Empty, PlatformBadge } from '../components/UI.jsx';
import styles from './CreatorDashboard.module.css';

export default function CreatorDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [period, setPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [creator, setCreator] = useState(null);
  const [summaryByPlat, setSummaryByPlat] = useState({});
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (period === 'custom' && !customFrom && !customTo) return;
    setLoading(true);
    try {
      const dates = periodToDates(period, customFrom, customTo);
      const [creators, ytRes, ttRes, igRes, vids] = await Promise.all([
        api.getCreators(),
        api.getSummary({ ...dates, platform: 'youtube', creator_id: id }),
        api.getSummary({ ...dates, platform: 'tiktok', creator_id: id }),
        api.getSummary({ ...dates, platform: 'instagram', creator_id: id }),
        api.getVideos({ ...dates, creator_id: id }),
      ]);
      const found = creators.find(c => String(c.id) === String(id));
      setCreator(found || null);
      setSummaryByPlat({ youtube: ytRes, tiktok: ttRes, instagram: igRes });
      setVideos(vids);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id, period, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);

  const allViews = ['youtube', 'tiktok', 'instagram'].reduce((s, p) => s + (summaryByPlat[p]?.total_views || 0), 0);
  const totalLikes = ['youtube', 'tiktok', 'instagram'].reduce((s, p) => s + (summaryByPlat[p]?.total_likes || 0), 0);
  const totalComments = ['youtube', 'tiktok', 'instagram'].reduce((s, p) => s + (summaryByPlat[p]?.total_comments || 0), 0);
  const totalSaves = ['youtube', 'tiktok', 'instagram'].reduce((s, p) => s + (summaryByPlat[p]?.total_saves || 0), 0);
  const totalShares = ['youtube', 'tiktok', 'instagram'].reduce((s, p) => s + (summaryByPlat[p]?.total_shares || 0), 0);
  const totalVideos = ['youtube', 'tiktok', 'instagram'].reduce((s, p) => s + (summaryByPlat[p]?.total_videos || 0), 0);
  const avgEr = allViews > 0 ? ((totalLikes + totalComments + totalSaves) / allViews * 100) : 0;

  const [showAllVideos, setShowAllVideos] = useState(false);
  const [videoSort, setVideoSort] = useState('views');

  // Топ видео по просмотрам
  const sortedVideos = [...videos].sort((a, b) => {
    if (videoSort === 'views') return (b.views || 0) - (a.views || 0);
    if (videoSort === 'er') return (b.er || 0) - (a.er || 0);
    if (videoSort === 'date') return (b.published_at || '').localeCompare(a.published_at || '');
    return 0;
  });
  const topVideos = sortedVideos.slice(0, 5);
  const allVideos = sortedVideos;

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
      />

      <div className={styles.toolbar}>
        <PeriodTabs value={period} onChange={setPeriod} customFrom={customFrom} customTo={customTo} onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }} />
      </div>

      {loading ? <Loader /> : (
        <div className="fade-in">

          {/* Метрики */}
          <div className={styles.metrics}>
            <MetricCard label="Просмотры" value={fmtNum(allViews)} sub={`${totalVideos} роликов`} />
            <MetricCard label="Лайки" value={fmtNum(totalLikes)} />
            <MetricCard label="Комментарии" value={fmtNum(totalComments)} />
            <MetricCard label="Сохранения" value={fmtNum(totalSaves)} />
            <MetricCard label="Репосты" value={fmtNum(totalShares)} />
            <MetricCard label="Средний ER" value={fmtEr(avgEr)} />
          </div>

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
                    <div className={styles.videoStats}>
                      <VStat label="Просм." value={fmtNum(v.views)} />
                      <VStat label="Лайки" value={fmtNum(v.likes)} />
                      <VStat label="ER" value={fmtEr(v.er)} accent />
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

          {allViews === 0 && <Empty icon="📊" text="Нет данных за выбранный период" sub="Попробуйте выбрать другой период" />}
        </div>
      )}
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

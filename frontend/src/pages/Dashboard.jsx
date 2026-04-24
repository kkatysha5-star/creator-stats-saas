import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fmtNum, fmtEr, platformMeta, periodToDates } from '../lib/utils.js';
import { PageHeader, MetricCard, PeriodTabs, PlatformDot, Avatar, Loader, Empty, ProgressBar } from '../components/UI.jsx';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const [period, setPeriod] = useState('month');
  const [platforms, setPlatforms] = useState(new Set(['youtube', 'tiktok', 'instagram']));
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [summaryByPlat, setSummaryByPlat] = useState({});
  const [byCreator, setByCreator] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState(null);
  const [rankTab, setRankTab] = useState('views');
  const navigate = useNavigate();

  const load = useCallback(async () => {
    if (period === 'custom' && !customFrom && !customTo) return;
    setLoading(true);
    try {
      const dates = periodToDates(period, customFrom, customTo);
      const [ytRes, ttRes, igRes, crRes] = await Promise.all([
        api.getSummary({ ...dates, platform: 'youtube' }),
        api.getSummary({ ...dates, platform: 'tiktok' }),
        api.getSummary({ ...dates, platform: 'instagram' }),
        api.getByCreator({ ...dates }),
      ]);
      setSummaryByPlat({ youtube: ytRes, tiktok: ttRes, instagram: igRes });
      setByCreator(crRes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [period, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);

  const togglePlatform = (p) => {
    setPlatforms(prev => {
      const next = new Set(prev);
      if (next.has(p) && next.size > 1) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const activePlats = ['youtube', 'tiktok', 'instagram'].filter(p => platforms.has(p));
  const summary = activePlats.reduce((acc, p) => {
    const s = summaryByPlat[p] || {};
    return {
      total_videos:   (acc.total_videos   || 0) + (s.total_videos   || 0),
      total_views:    (acc.total_views    || 0) + (s.total_views    || 0),
      total_likes:    (acc.total_likes    || 0) + (s.total_likes    || 0),
      total_comments: (acc.total_comments || 0) + (s.total_comments || 0),
      total_shares:   (acc.total_shares   || 0) + (s.total_shares   || 0),
    };
  }, {});

  const allViews = ['youtube', 'tiktok', 'instagram'].reduce((s, p) => s + (summaryByPlat[p]?.total_views || 0), 0);
  const avgEr = byCreator.length > 0
    ? byCreator.filter(c => c.avg_er > 0).reduce((s, c) => s + parseFloat(c.avg_er || 0), 0) / Math.max(1, byCreator.filter(c => c.avg_er > 0).length)
    : 0;

  const totalVideoPlan = byCreator.reduce((s, c) => {
    return s + (c.video_plan_period === 'week' ? (c.video_plan_count || 0) * 4 : (c.video_plan_count || 0));
  }, 0);
  const totalReachPlan = byCreator.reduce((s, c) => s + (c.reach_plan || 0), 0);
  const totalVideos = byCreator.reduce((s, c) => s + (c.total_videos || 0), 0);
  const reachPct = totalReachPlan > 0 ? Math.min(Math.round(allViews / totalReachPlan * 100), 100) : null;
  const videoPct = totalVideoPlan > 0 ? Math.min(Math.round(totalVideos / totalVideoPlan * 100), 100) : null;

  const filteredCreators = byCreator.filter(c => {
    if (!c.platforms) return false;
    return c.platforms.split(',').some(p => platforms.has(p));
  });

  const metrics = [
    { id: 'views',    label: 'Просмотры',   raw: summary.total_views,    fmt: fmtNum(summary.total_views),    sub: `${totalVideos} роликов` },
    { id: 'likes',    label: 'Лайки',       raw: summary.total_likes,    fmt: fmtNum(summary.total_likes) },
    { id: 'comments', label: 'Комментарии', raw: summary.total_comments, fmt: fmtNum(summary.total_comments) },
    { id: 'shares',   label: 'Репосты',     raw: summary.total_shares,   fmt: fmtNum(summary.total_shares) },
    { id: 'er',       label: 'Средний ER',  raw: null,                   fmt: fmtEr(avgEr) },
  ];

  return (
    <div className={styles.page}>
      <PageHeader title="Дашборд" subtitle="Сводная статистика по всем креаторам" />

      <div className={styles.toolbar}>
        <PeriodTabs value={period} onChange={setPeriod} customFrom={customFrom} customTo={customTo} onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }} />
        <div className={styles.platFilters}>
          {['youtube', 'tiktok', 'instagram'].map(p => {
            const { label, color } = platformMeta(p);
            const active = platforms.has(p);
            return (
              <button
                key={p}
                className={[styles.platBtn, active ? styles.platActive : ''].join(' ')}
                style={active ? { borderColor: color + '55', color, background: color + '12' } : {}}
                onClick={() => togglePlatform(p)}
              >
                <PlatformDot platform={p} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? <Loader rows={5} /> : (
        <div className="fade-in">

          {/* ── Метрики ─────────────────────────────────────────────────── */}
          <div className={styles.metrics}>
            {metrics.map(m => (
              <MetricCard
                key={m.id}
                label={m.label}
                value={m.fmt}
                rawValue={m.raw}
                sub={m.sub}
                onClick={() => setActiveMetric(activeMetric === m.id ? null : m.id)}
                active={activeMetric === m.id}
              />
            ))}
          </div>

          {/* ── Просмотры по платформам ──────────────────────────────── */}
          {allViews > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Просмотры по платформам</h2>
              <div className={styles.platBars}>
                {['youtube', 'tiktok', 'instagram'].map(p => {
                  const { label, color } = platformMeta(p);
                  const views = summaryByPlat[p]?.total_views || 0;
                  if (!views) return null;
                  const pct = allViews > 0 ? Math.round(views / allViews * 100) : 0;
                  return (
                    <div key={p} className={styles.platBarRow}>
                      <div className={styles.platBarMeta}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 7, color, fontWeight: 600, fontSize: 13 }}>
                          <PlatformDot platform={p} /> {label}
                        </span>
                        <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>{fmtNum(views)}</span>
                          <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, minWidth: 32, textAlign: 'right' }}>{pct}%</span>
                        </span>
                      </div>
                      <div className={styles.platProgressTrack}>
                        <div className={styles.platProgressFill} style={{ width: pct + '%', background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Два блока: Рейтинг + План/Факт ───────────────────────── */}
          <div className={styles.twoCol}>

            {/* Рейтинг креаторов */}
            {filteredCreators.length > 0 && (
              <div className={styles.rankBlock}>
                <div className={styles.rankHeader}>
                  <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Рейтинг</h2>
                  <div className={styles.rankTabs}>
                    {[
                      { id: 'views', label: 'Просмотры' },
                      { id: 'er',    label: 'ER' },
                    ].map(t => (
                      <button
                        key={t.id}
                        className={[styles.rankTab, rankTab === t.id ? styles.rankTabActive : ''].join(' ')}
                        onClick={() => setRankTab(t.id)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <RankingList creators={filteredCreators} tab={rankTab} onOpen={id => navigate(`/creator/${id}`)} />
              </div>
            )}

            {/* План / Факт */}
            {(videoPct !== null || reachPct !== null) && (
              <div className={styles.planBlock}>
                <h2 className={styles.sectionTitle}>План / Факт</h2>

                {videoPct !== null && (
                  <div className={styles.planRow}>
                    <div className={styles.planRowTop}>
                      <span className={styles.planLabel}>🎬 Ролики</span>
                      <span className={styles.planVals}>{totalVideos} / {totalVideoPlan}</span>
                    </div>
                    <ProgressBar pct={videoPct} />
                    <span className={styles.planPct} style={{ color: videoPct >= 70 ? '#4ade80' : videoPct >= 40 ? '#ff6a00' : '#f87171' }}>{videoPct}%</span>
                  </div>
                )}

                {reachPct !== null && (
                  <div className={styles.planRow}>
                    <div className={styles.planRowTop}>
                      <span className={styles.planLabel}>👁 Охваты</span>
                      <span className={styles.planVals}>{fmtNum(allViews)} / {fmtNum(totalReachPlan)}</span>
                    </div>
                    <ProgressBar pct={reachPct} />
                    <span className={styles.planPct} style={{ color: reachPct >= 70 ? '#4ade80' : reachPct >= 40 ? '#ff6a00' : '#f87171' }}>{reachPct}%</span>
                  </div>
                )}

                {/* По каждому креатору */}
                {byCreator.filter(c => {
                  const mp = c.video_plan_period === 'week' ? (c.video_plan_count||0)*4 : (c.video_plan_count||0);
                  return mp > 0;
                }).map(c => {
                  const mp = c.video_plan_period === 'week' ? (c.video_plan_count||0)*4 : (c.video_plan_count||0);
                  const pct = Math.min(Math.round((c.total_videos||0) / mp * 100), 100);
                  return (
                    <div key={c.creator_id} className={styles.planCreatorRow}>
                      <div className={styles.planCreatorTop}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>
                          <Avatar name={c.creator_name} color={c.avatar_color} size={20} />
                          {c.creator_name}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>{c.total_videos||0}/{mp}</span>
                      </div>
                      <ProgressBar pct={pct} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Таблица креаторов ─────────────────────────────────────── */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>По креаторам</h2>
            {filteredCreators.length === 0
              ? <Empty text="Нет данных за выбранный период" sub="Добавьте видео на странице «Ролики»" />
              : (
                <div className={styles.creatorsTable}>
                  {(() => {
                    const hasVideoPlan = filteredCreators.some(c => (c.video_plan_period === 'week' ? (c.video_plan_count||0)*4 : (c.video_plan_count||0)) > 0);
                    const gridCols = `1fr 100px${hasVideoPlan ? ' 110px' : ''} 130px 90px 90px 70px 70px`;
                    return (
                      <>
                        <div className={styles.tableHead} style={{ gridTemplateColumns: gridCols }}>
                          <span>Креатор</span>
                          <span>Ролики</span>
                          {hasVideoPlan && <span>План/Факт</span>}
                          <span>Просмотры</span>
                          <span>Лайки</span>
                          <span>Коммент.</span>
                          <span>Репосты</span>
                          <span>ER</span>
                        </div>
                        {filteredCreators.map(c => (
                          <CreatorRow
                            key={c.creator_id}
                            creator={c}
                            activePlatforms={platforms}
                            onOpen={() => navigate(`/creator/${c.creator_id}`)}
                            showVideoPlan={hasVideoPlan}
                            gridCols={gridCols}
                          />
                        ))}
                      </>
                    );
                  })()}
                </div>
              )
            }
          </div>
        </div>
      )}
    </div>
  );
}

function RankingList({ creators, tab, onOpen }) {
  const sorted = [...creators].sort((a, b) => {
    if (tab === 'er') return (parseFloat(b.avg_er)||0) - (parseFloat(a.avg_er)||0);
    return (b.total_views||0) - (a.total_views||0);
  });
  const max = sorted[0] ? (tab === 'er' ? parseFloat(sorted[0].avg_er||0) : sorted[0].total_views||0) : 1;
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className={styles.rankList}>
      {sorted.slice(0, 6).map((c, i) => {
        const val = tab === 'er' ? parseFloat(c.avg_er||0) : (c.total_views||0);
        const pct = max > 0 ? Math.round(val / max * 100) : 0;
        const { color } = platformMeta('youtube'); // fallback
        const platColors = { youtube: '#ff4444', tiktok: '#32cd64', instagram: '#ff6a00' };
        const mainPlat = c.platforms?.split(',')[0];
        const barColor = platColors[mainPlat] || '#ff6a00';
        return (
          <div key={c.creator_id} className={styles.rankRow} onClick={() => onOpen(c.creator_id)}>
            <span className={styles.rankPos}>{medals[i] || `#${i+1}`}</span>
            <Avatar name={c.creator_name} color={c.avatar_color} size={26} />
            <div className={styles.rankInfo}>
              <span className={styles.rankName}>{c.creator_name}</span>
              <ProgressBar pct={pct} color={barColor} />
            </div>
            <span className={styles.rankVal}>
              {tab === 'er' ? fmtEr(c.avg_er) : fmtNum(c.total_views)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CreatorRow({ creator: c, activePlatforms, onOpen, showVideoPlan, gridCols }) {
  const plats = c.platforms ? c.platforms.split(',').filter(p => activePlatforms.has(p)) : [];
  const monthPlan = c.video_plan_period === 'week' ? (c.video_plan_count||0)*4 : (c.video_plan_count||0);
  const videoPct = monthPlan > 0 ? Math.min(Math.round((c.total_videos||0) / monthPlan * 100), 100) : null;

  return (
    <div className={styles.tableRow} style={{ gridTemplateColumns: gridCols }}>
      <div className={styles.creatorCell} onClick={onOpen}>
        <Avatar name={c.creator_name} color={c.avatar_color} size={28} />
        <span className={styles.creatorName}>{c.creator_name}</span>
        <div className={styles.platDots}>{plats.map(p => <PlatformDot key={p} platform={p} />)}</div>
      </div>
      <span className={styles.mono}>{c.total_videos || 0}</span>
      {showVideoPlan && (
        <span className={styles.mono}>
          {monthPlan > 0 ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{c.total_videos||0}/{monthPlan}</span>
              <span style={{ fontSize: 10, color: videoPct >= 70 ? '#4ade80' : videoPct >= 40 ? '#ff6a00' : '#f87171', fontWeight: 600 }}>{videoPct}%</span>
            </span>
          ) : <span style={{ color: 'var(--text3)' }}>—</span>}
        </span>
      )}
      <span className={styles.mono}>{fmtNum(c.total_views)}</span>
      <span className={styles.mono}>{fmtNum(c.total_likes)}</span>
      <span className={styles.mono}>{fmtNum(c.total_comments)}</span>
      <span className={styles.mono}>{c.total_shares ? fmtNum(c.total_shares) : <span style={{ color: 'var(--text3)' }}>—</span>}</span>
      <span className={styles.erVal}>{fmtEr(c.avg_er)}</span>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fmtNum, fmtEr, platformMeta, periodToDates, getCompareDates, calcDelta, planColor, pluralVideos, reachScheduleStatus } from '../lib/utils.js';
import { PageHeader, MetricCard, PeriodTabs, PlatformDot, Avatar, Loader, Empty, ProgressBar, CircularProgress, CompareSelector, COMPARE_OPTIONS } from '../components/UI.jsx';
import { useAuth } from '../App.jsx';
import styles from './Dashboard.module.css';

const normalizeSummary = (res) => (res && typeof res === 'object' && !Array.isArray(res) ? res : {});
const normalizeList = (res) => Array.isArray(res) ? res : [];

export default function Dashboard() {
  const { auth } = useAuth();
  const workspace = auth?.workspaces?.[0];
  const isPro = workspace?.plan === 'pro';

  const [period, setPeriod] = useState('month');
  const [platforms, setPlatforms] = useState(new Set(['youtube', 'tiktok', 'instagram']));
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [summaryByPlat, setSummaryByPlat] = useState({});
  const [prevSummaryByPlat, setPrevSummaryByPlat] = useState({});
  const [byCreator, setByCreator] = useState([]);
  const [prevByCreator, setPrevByCreator] = useState([]);
  const [funnelPayouts, setFunnelPayouts] = useState({});
  const [compareWith, setCompareWith] = useState('prev_period');
  const [compareCustomFrom, setCompareCustomFrom] = useState('');
  const [compareCustomTo, setCompareCustomTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeMetric, setActiveMetric] = useState(null);
  const [rankTab, setRankTab] = useState('views');
  const navigate = useNavigate();

  const load = useCallback(async () => {
    if (period === 'custom' && !customFrom && !customTo) return;
    setLoading(true);
    setLoadError('');
    try {
      const dates = periodToDates(period, customFrom, customTo);
      const prevDates = getCompareDates(compareWith, period, customFrom, customTo, compareCustomFrom, compareCustomTo);

      const requests = [
        api.getSummary({ ...dates, platform: 'youtube' }),
        api.getSummary({ ...dates, platform: 'tiktok' }),
        api.getSummary({ ...dates, platform: 'instagram' }),
        api.getByCreator({ ...dates }),
      ];
      if (prevDates) {
        requests.push(
          api.getSummary({ ...prevDates, platform: 'youtube' }),
          api.getSummary({ ...prevDates, platform: 'tiktok' }),
          api.getSummary({ ...prevDates, platform: 'instagram' }),
          api.getByCreator({ ...prevDates }),
        );
      }
      if (isPro) {
        requests.push(api.getFunnelPeriods().catch(() => []));
      }

      const results = await Promise.all(requests);
      const [ytRes, ttRes, igRes, crRes] = results;
      setSummaryByPlat({
        youtube: normalizeSummary(ytRes),
        tiktok: normalizeSummary(ttRes),
        instagram: normalizeSummary(igRes),
      });
      setByCreator(normalizeList(crRes));

      if (prevDates) {
        const [,,, , pYt, pTt, pIg, pCr] = results;
        setPrevSummaryByPlat({
          youtube: normalizeSummary(pYt),
          tiktok: normalizeSummary(pTt),
          instagram: normalizeSummary(pIg),
        });
        setPrevByCreator(normalizeList(pCr));
      } else {
        setPrevSummaryByPlat({});
        setPrevByCreator([]);
      }

      if (isPro) {
        const periods = normalizeList(results[results.length - 1]);
        const map = {};
        periods.forEach(p => {
          const cid = p.creator_id;
          map[cid] = (map[cid] || 0) + (parseFloat(p.payout) || 0);
        });
        setFunnelPayouts(map);
      }
    } catch (e) {
      console.error(e);
      setSummaryByPlat({});
      setPrevSummaryByPlat({});
      setByCreator([]);
      setPrevByCreator([]);
      setFunnelPayouts({});
      setLoadError(e?.message || 'Не удалось загрузить данные дашборда');
    } finally {
      setLoading(false);
    }
  }, [period, customFrom, customTo, compareWith, compareCustomFrom, compareCustomTo, isPro]);

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

  const sumPlats = (obj) => activePlats.reduce((acc, p) => {
    const s = obj[p] || {};
    return {
      total_views:    (acc.total_views    || 0) + (Number(s.total_views)    || 0),
      total_likes:    (acc.total_likes    || 0) + (Number(s.total_likes)    || 0),
      total_comments: (acc.total_comments || 0) + (Number(s.total_comments) || 0),
      total_shares:   (acc.total_shares   || 0) + (Number(s.total_shares)   || 0),
    };
  }, {});

  const summary     = sumPlats(summaryByPlat);
  const prevSummary = sumPlats(prevSummaryByPlat);

  const allViews = ['youtube', 'tiktok', 'instagram'].reduce((s, p) => s + (Number(summaryByPlat[p]?.total_views) || 0), 0);
  const avgEr = byCreator.filter(c => c.avg_er > 0).reduce((s, c, _, a) => s + parseFloat(c.avg_er || 0) / a.length, 0);
  const prevAvgEr = prevByCreator.filter(c => c.avg_er > 0).reduce((s, c, _, a) => s + parseFloat(c.avg_er || 0) / a.length, 0);

  // hasPrev: только когда в предыдущем периоде реально есть данные
  const hasPrev = ['youtube', 'tiktok', 'instagram'].some(p => (Number(prevSummaryByPlat[p]?.total_views) || 0) > 0);

  const totalVideoPlan = byCreator.reduce((s, c) => s + (c.video_plan_period === 'week' ? (c.video_plan_count || 0) * 4 : (c.video_plan_count || 0)), 0);
  const totalReachPlan = byCreator.reduce((s, c) => s + (c.reach_plan || 0), 0);
  const totalVideos    = byCreator.reduce((s, c) => s + (c.total_videos || 0), 0);
  const reachPct = totalReachPlan > 0 ? Math.min(Math.round(allViews / totalReachPlan * 100), 100) : null;
  const videoPct = totalVideoPlan > 0 ? Math.min(Math.round(totalVideos / totalVideoPlan * 100), 100) : null;

  const filteredCreators = byCreator.filter(c => c.platforms?.split(',').some(p => platforms.has(p)));
  const creatorsWithPlan = byCreator.filter(c => (c.video_plan_period === 'week' ? (c.video_plan_count||0)*4 : (c.video_plan_count||0)) > 0);

  // Агрегированный статус для плиток
  const videoSchedList = creatorsWithPlan.map(scheduleStatus).filter(Boolean);
  const videoTileStatus = videoSchedList.length > 0 ? {
    ok: videoSchedList.every(s => s.ok),
    behind: videoSchedList.filter(s => !s.ok).length,
  } : null;

  const creatorsWithReach = byCreator.filter(c => (c.reach_plan || 0) > 0);
  const reachSchedList = creatorsWithReach.map(c => reachScheduleStatus(c.period_start, c.reach_plan, c.total_views)).filter(Boolean);
  const reachTileStatus = reachSchedList.length > 0 ? { ok: reachSchedList.every(s => s.ok) } : null;

  const d = (curr, prev) => hasPrev ? calcDelta(curr, prev) : null;

  const metrics = [
    { id: 'views',    label: 'Просмотры',   raw: summary.total_views,    fmt: fmtNum(summary.total_views),    sub: `${totalVideos} роликов`, delta: d(summary.total_views, prevSummary.total_views) },
    { id: 'likes',    label: 'Лайки',       raw: summary.total_likes,    fmt: fmtNum(summary.total_likes),    delta: d(summary.total_likes, prevSummary.total_likes) },
    { id: 'comments', label: 'Комментарии', raw: summary.total_comments, fmt: fmtNum(summary.total_comments), delta: d(summary.total_comments, prevSummary.total_comments) },
    { id: 'shares',   label: 'Репосты',     raw: summary.total_shares,   fmt: fmtNum(summary.total_shares),   delta: d(summary.total_shares, prevSummary.total_shares) },
    { id: 'er',       label: 'Средний ER',  raw: null,                   fmt: fmtEr(avgEr),                   delta: d(avgEr, prevAvgEr) },
  ];

  const rankTabs = [
    { id: 'views', label: 'Просмотры' },
    { id: 'er',    label: 'ER' },
    { id: 'sales', label: isPro ? 'Продажи' : '🔒 Продажи', locked: !isPro },
  ];

  return (
    <div className={styles.page}>
      <PageHeader title="Дашборд" subtitle="Сводная статистика по всем креаторам" />

      <div className={styles.toolbar}>
        <PeriodTabs value={period} onChange={setPeriod} customFrom={customFrom} customTo={customTo}
          onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }} />
        <CompareSelector
          value={compareWith} onChange={setCompareWith}
          customFrom={compareCustomFrom} customTo={compareCustomTo}
          onCustomChange={(f,t)=>{ setCompareCustomFrom(f); setCompareCustomTo(t); }}
        />
        <div className={styles.platFilters}>
          {['youtube', 'tiktok', 'instagram'].map(p => {
            const { label, color } = platformMeta(p);
            const active = platforms.has(p);
            return (
              <button key={p}
                className={[styles.platBtn, active ? styles.platActive : ''].join(' ')}
                style={active ? { borderColor: color + '55', color, background: color + '12' } : {}}
                onClick={() => togglePlatform(p)}
              >
                <PlatformDot platform={p} /> {label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? <Loader rows={5} /> : loadError ? (
        <Empty icon="⚠️" text="Не удалось загрузить дашборд" sub={loadError} />
      ) : (
        <div className="fade-in">

          {/* ── Метрики ──────────────────────────────────────────── */}
          {hasPrev && (
            <div className={styles.compareLabel}>
              ↔ сравнение: {COMPARE_OPTIONS.find(o => o.value === compareWith)?.label}
            </div>
          )}
          <div className={styles.metrics} data-tour="metrics">
            {metrics.map(m => (
              <MetricCard key={m.id} label={m.label} value={m.fmt} rawValue={m.raw}
                sub={m.sub} delta={m.delta}
                onClick={() => setActiveMetric(activeMetric === m.id ? null : m.id)}
                active={activeMetric === m.id}
              />
            ))}
          </div>

          {/* ── Платформы + Рейтинг ──────────────────────────────── */}
          <div className={styles.twoCol}>
            {allViews > 0 && (
              <div className={styles.platBarsCard} data-tour="plat-bars">
                <h2 className={styles.sectionTitle}>Просмотры по платформам</h2>
                <div className={styles.platBars}>
                  {['youtube', 'tiktok', 'instagram'].map(p => {
                    const { label, color } = platformMeta(p);
                    const views = Number(summaryByPlat[p]?.total_views) || 0;
                    const prevViews = Number(prevSummaryByPlat[p]?.total_views) || 0;
                    if (!views) return null;
                    const pct = allViews > 0 ? Math.round(views / allViews * 100) : 0;
                    const delta = hasPrev ? calcDelta(views, prevViews) : null;
                    return (
                      <div key={p} className={styles.platBarRow}>
                        <div className={styles.platBarMeta}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 7, color, fontWeight: 600, fontSize: 13 }}>
                            <PlatformDot platform={p} /> {label}
                          </span>
                          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {delta != null && (
                              <span style={{ fontSize: 11, fontWeight: 700, color: delta > 0 ? 'var(--color-ok)' : 'var(--color-bad)' }}>
                                {delta > 0 ? '↑' : '↓'}{Math.abs(delta).toFixed(1)}%
                              </span>
                            )}
                            <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>{fmtNum(views)}</span>
                            <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, minWidth: 30, textAlign: 'right' }}>{pct}%</span>
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

            {filteredCreators.length > 0 && (
              <div className={styles.rankBlock} data-tour="ranking">
                <div className={styles.rankHeader}>
                  <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Рейтинг</h2>
                  <div className={styles.rankTabs}>
                    {rankTabs.map(t => (
                      <button key={t.id}
                        className={[styles.rankTab, rankTab === t.id ? styles.rankTabActive : '', t.locked ? styles.rankTabLocked : ''].join(' ')}
                        onClick={() => !t.locked && setRankTab(t.id)}
                        title={t.locked ? 'Доступно на Pro-тарифе' : ''}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                {rankTab === 'sales' && !isPro
                  ? <div className={styles.rankLocked}>
                      <span style={{ fontSize: 22 }}>🔒</span>
                      <span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 500 }}>Рейтинг по продажам — тариф Pro</span>
                      <button className={styles.rankUpgradeBtn} onClick={() => navigate('/settings')}>Перейти на Pro →</button>
                    </div>
                  : <RankingList creators={filteredCreators} tab={rankTab} funnelPayouts={funnelPayouts} onOpen={id => navigate(`/creator/${id}`)} />
                }
              </div>
            )}
          </div>

          {/* ── Три плитки: Ролики | Охваты | По креаторам ───────── */}
          {(videoPct !== null || reachPct !== null || creatorsWithPlan.length > 0) && (
            <div className={styles.planGrid}>

              {/* Плитка 1: ролики */}
              {videoPct !== null && (
                <div className={styles.planTile}>
                  <div className={styles.planTileLabel}>🎬 Ролики</div>
                  <div className={styles.planTileCenter}>
                    <div className={styles.planCircleWrap}>
                      <CircularProgress pct={videoPct} size={96} stroke={7} color={planColor(videoPct)} />
                      <div className={styles.planCircleInner}>
                        <span className={styles.planCirclePct} style={{ color: planColor(videoPct) }}>
                          {videoPct}%
                        </span>
                      </div>
                    </div>
                    <div className={styles.planTileStats}>
                      <span className={styles.planTileFact}>{totalVideos}</span>
                      <span className={styles.planTileSep}>/</span>
                      <span className={styles.planTilePlan}>{totalVideoPlan}</span>
                    </div>
                    <span className={styles.planTileSub}>факт / план</span>
                    {videoTileStatus && (
                      <span className={styles.planTileStatus} style={{ color: videoTileStatus.ok ? 'var(--color-ok)' : 'var(--color-bad)' }}>
                        {videoTileStatus.ok ? '✓ в графике' : `↓ ${videoTileStatus.behind} ${videoTileStatus.behind === 1 ? 'отстаёт' : 'отстают'}`}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Плитка 2: охваты */}
              {reachPct !== null && (
                <div className={styles.planTile}>
                  <div className={styles.planTileLabel}>👁 Охваты</div>
                  <div className={styles.planTileCenter}>
                    <div className={styles.planCircleWrap}>
                      <CircularProgress pct={reachPct} size={96} stroke={7} color={planColor(reachPct)} />
                      <div className={styles.planCircleInner}>
                        <span className={styles.planCirclePct} style={{ color: planColor(reachPct) }}>
                          {reachPct}%
                        </span>
                      </div>
                    </div>
                    <div className={styles.planTileStats}>
                      <span className={styles.planTileFact}>{fmtNum(allViews)}</span>
                      <span className={styles.planTileSep}>/</span>
                      <span className={styles.planTilePlan}>{fmtNum(totalReachPlan)}</span>
                    </div>
                    <span className={styles.planTileSub}>просм. / план</span>
                    {reachTileStatus && (
                      <span className={styles.planTileStatus} style={{ color: reachTileStatus.ok ? 'var(--color-ok)' : 'var(--color-bad)' }}>
                        {reachTileStatus.ok ? '✓ в графике' : '↓ отстаёт'}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Плитка 3: по каждому креатору */}
              {creatorsWithPlan.length > 0 && (
                <div className={styles.planTile + ' ' + styles.planTileWide}>
                  <div className={styles.planTileLabel}>Выполнение по креаторам</div>
                  <div className={styles.planCreatorList}>
                    {creatorsWithPlan.map(c => {
                      const mp = c.video_plan_period === 'week' ? (c.video_plan_count||0)*4 : (c.video_plan_count||0);
                      const pct = Math.min(Math.round((c.total_videos||0) / mp * 100), 100);
                      const color = planColor(pct);
                      return (
                        <div key={c.creator_id} className={styles.planCreatorItem}
                          onClick={() => navigate(`/creator/${c.creator_id}`)}>
                          <div className={styles.planCreatorLeft}>
                            <Avatar name={c.creator_name} color={c.avatar_color} size={24} />
                            <span className={styles.planCreatorName}>{c.creator_name}</span>
                          </div>
                          <div className={styles.planCreatorRight}>
                            <span className={styles.planCreatorCount} style={{ color }}>{c.total_videos||0}/{mp}</span>
                            <div className={styles.planMiniBar}>
                              <div className={styles.planMiniFill} style={{ width: pct + '%', background: color }} />
                            </div>
                            <span className={styles.planCreatorPct} style={{ color }}>{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Таблица креаторов ─────────────────────────────────── */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>По креаторам</h2>
            {filteredCreators.length === 0
              ? <Empty text="Нет данных за выбранный период" sub="Добавьте видео на странице «Ролики»" />
              : <CreatorsTable
                  creators={filteredCreators}
                  prevByCreator={prevByCreator}
                  activePlatforms={platforms}
                  hasPrev={hasPrev}
                  onOpen={id => navigate(`/creator/${id}`)}
                />
            }
          </div>
        </div>
      )}
    </div>
  );
}

function RankingList({ creators, tab, funnelPayouts, onOpen }) {
  const sorted = [...creators].sort((a, b) => {
    if (tab === 'er')    return (parseFloat(b.avg_er) || 0) - (parseFloat(a.avg_er) || 0);
    if (tab === 'sales') return (funnelPayouts[b.creator_id] || 0) - (funnelPayouts[a.creator_id] || 0);
    return (b.total_views || 0) - (a.total_views || 0);
  });
  const max = sorted[0] ? (
    tab === 'er'    ? parseFloat(sorted[0].avg_er || 0) :
    tab === 'sales' ? (funnelPayouts[sorted[0].creator_id] || 0) :
    sorted[0].total_views || 0
  ) : 1;
  const medals = ['🥇','🥈','🥉'];
  const platColors = { youtube: '#ff4444', tiktok: '#32cd64', instagram: '#ff6a00' };

  return (
    <div className={styles.rankList}>
      {sorted.slice(0, 6).map((c, i) => {
        const val = tab === 'er' ? parseFloat(c.avg_er || 0) :
                    tab === 'sales' ? (funnelPayouts[c.creator_id] || 0) :
                    (c.total_views || 0);
        const pct = max > 0 ? Math.round(val / max * 100) : 0;
        const mainPlat = c.platforms?.split(',')[0];
        const barColor = platColors[mainPlat] || '#ff6a00';
        const displayVal = tab === 'er' ? fmtEr(c.avg_er) :
                           tab === 'sales' ? `₽ ${fmtNum(Math.round(val))}` :
                           fmtNum(c.total_views);
        return (
          <div key={c.creator_id} className={styles.rankRow} onClick={() => onOpen(c.creator_id)}>
            <span className={styles.rankPos}>{medals[i] || `#${i+1}`}</span>
            <Avatar name={c.creator_name} color={c.avatar_color} size={26} />
            <div className={styles.rankInfo}>
              <span className={styles.rankName}>{c.creator_name}</span>
              <ProgressBar pct={pct} color={barColor} />
            </div>
            <span className={styles.rankVal}>{displayVal}</span>
          </div>
        );
      })}
    </div>
  );
}

function scheduleStatus(c) {
  const rate = Number(c.daily_rate);
  if (!c.period_start || !rate) return null;
  const start = new Date(c.period_start + 'T00:00:00');
  const today = new Date();
  if (today < start) return null;
  const days = Math.floor((today - start) / 86400000);
  const expected = Math.round(rate * days);
  const actual = Number(c.total_videos) || 0;
  const delta = actual - expected;
  return { delta, ok: delta >= 0 };
}

function CreatorsTable({ creators, prevByCreator, activePlatforms, hasPrev, onOpen }) {
  const prevMap = {};
  prevByCreator.forEach(c => { prevMap[c.creator_id] = c; });

  const monthPlan = c => c.video_plan_period === 'week' ? (c.video_plan_count||0)*4 : (c.video_plan_count||0);
  const hasVideoPlan = creators.some(c => monthPlan(c) > 0);
  const hasReachPlan = creators.some(c => (c.reach_plan || 0) > 0);

  const cols = [
    'creator',
    'platforms',
    hasVideoPlan && 'videoPlan',
    hasReachPlan && 'reachPlan',
    'views',
    'likes',
    'comments',
    'er',
  ].filter(Boolean);

  const colWidths = {
    creator:    'minmax(150px,1.5fr)',
    platforms:  '100px',
    videoPlan:  '140px',
    reachPlan:  '130px',
    views:      'minmax(90px,1fr)',
    likes:      'minmax(80px,1fr)',
    comments:   'minmax(80px,1fr)',
    er:         '70px',
  };
  const gridCols = cols.map(c => colWidths[c]).join(' ');

  return (
    <div className={styles.creatorsTable}>
      <div className={styles.tableHead} style={{ gridTemplateColumns: gridCols }}>
        <span>Креатор</span>
        <span>Платформы</span>
        {hasVideoPlan && <span>Ролики план/факт</span>}
        {hasReachPlan && <span>Охваты план/факт</span>}
        <span>Просмотры</span>
        <span>Лайки</span>
        <span>Коммент.</span>
        <span>ER</span>
      </div>
      {creators.map((c, ci) => {
        const prev = prevMap[c.creator_id];
        const plats = c.platforms ? c.platforms.split(',').filter(p => activePlatforms.has(p)) : [];
        const mp = monthPlan(c);
        const videoPct = mp > 0 ? Math.min(Math.round((c.total_videos||0) / mp * 100), 100) : null;
        const reachPct = c.reach_plan > 0 ? Math.min(Math.round((c.total_views||0) / c.reach_plan * 100), 100) : null;
        const sched = scheduleStatus(c);
        const rSched = reachScheduleStatus(c.period_start, c.reach_plan, c.total_views);
        const vColor = videoPct != null ? planColor(videoPct) : 'var(--text3)';
        const rColor = reachPct != null ? planColor(reachPct) : 'var(--text3)';
        const dv = (curr, p) => hasPrev && prev ? calcDelta(curr, p) : null;

        return (
          <div key={c.creator_id} className={styles.tableRow} style={{ gridTemplateColumns: gridCols }} {...(ci === 0 ? { 'data-tour': 'creator-row' } : {})}>
            <div className={styles.creatorCell} onClick={() => onOpen(c.creator_id)}>
              <Avatar name={c.creator_name} color={c.avatar_color} size={28} />
              <span className={styles.creatorName}>{c.creator_name}</span>
            </div>
            <div className={styles.platVideosCell}>
              <div className={styles.platDots}>{plats.map(p => <PlatformDot key={p} platform={p} />)}</div>
              <span className={styles.platCount}>{c.total_videos || 0}</span>
            </div>
            {hasVideoPlan && (
              <div className={styles.planCell}>
                {mp > 0 ? (
                  <>
                    <span className={styles.planCellMain}>
                      {c.total_videos||0}<span className={styles.planCellSep}>/</span>{mp}
                      <span className={styles.planCellPct} style={{ color: vColor }}>{videoPct}%</span>
                    </span>
                    {sched && (
                      <span className={styles.planCellStatus} style={{ color: sched.ok ? 'var(--color-ok)' : 'var(--color-bad)' }}>
                        {sched.ok
                          ? `✓ в графике${sched.delta > 0 ? ` (+${sched.delta})` : ''}`
                          : `↓ отстаёт на ${Math.abs(sched.delta)} ${pluralVideos(sched.delta)}`}
                      </span>
                    )}
                  </>
                ) : <span style={{ color: 'var(--text3)' }}>—</span>}
              </div>
            )}
            {hasReachPlan && (
              <div className={styles.planCell}>
                {c.reach_plan > 0 ? (
                  <>
                    <span className={styles.planCellMain}>
                      {fmtNum(c.total_views||0)}<span className={styles.planCellSep}>/</span>{fmtNum(c.reach_plan)}
                    </span>
                    <span className={styles.planCellPct} style={{ color: rColor }}>{reachPct}%</span>
                    {rSched && (
                      <span className={styles.planCellStatus} style={{ color: rSched.ok ? 'var(--color-ok)' : 'var(--color-bad)' }}>
                        {rSched.ok ? '✓ в графике' : `↓ отстаёт на ${fmtNum(Math.abs(rSched.delta))}`}
                      </span>
                    )}
                  </>
                ) : <span style={{ color: 'var(--text3)' }}>—</span>}
              </div>
            )}
            <span className={styles.monoCell}>
              {fmtNum(c.total_views)}<DeltaInline val={dv(c.total_views, prev?.total_views)} />
            </span>
            <span className={styles.monoCell}>
              {fmtNum(c.total_likes)}<DeltaInline val={dv(c.total_likes, prev?.total_likes)} />
            </span>
            <span className={styles.monoCell}>
              {fmtNum(c.total_comments)}<DeltaInline val={dv(c.total_comments, prev?.total_comments)} />
            </span>
            <span className={styles.erVal}>{fmtEr(c.avg_er)}</span>
          </div>
        );
      })}
    </div>
  );
}

function DeltaInline({ val }) {
  if (val == null) return null;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: val > 0 ? 'var(--color-ok)' : 'var(--color-bad)', marginLeft: 4, whiteSpace: 'nowrap' }}>
      {val > 0 ? '↑' : '↓'}{Math.abs(val).toFixed(1)}%
    </span>
  );
}

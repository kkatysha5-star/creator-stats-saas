import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fmtNum, fmtEr, platformMeta, periodToDates } from '../lib/utils.js';
import { PageHeader, MetricCard, PeriodTabs, PlatformDot, Avatar, Btn, Loader, Empty } from '../components/UI.jsx';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const [period, setPeriod] = useState('month');
  const [platforms, setPlatforms] = useState(new Set(['youtube', 'tiktok', 'instagram']));
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [summaryByPlat, setSummaryByPlat] = useState({});
  const [byCreator, setByCreator] = useState([]);
  const [loading, setLoading] = useState(true);
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
      total_saves:    (acc.total_saves    || 0) + (s.total_saves    || 0),
      total_shares:   (acc.total_shares   || 0) + (s.total_shares   || 0),
    };
  }, {});

  const allViews = ['youtube', 'tiktok', 'instagram'].reduce((s, p) => s + (summaryByPlat[p]?.total_views || 0), 0);

  // Суммарный план роликов и охватов по всем креаторам
  const totalVideoPlan = byCreator.reduce((s, c) => {
    const monthly = c.video_plan_period === 'week' ? (c.video_plan_count || 0) * 4 : (c.video_plan_count || 0);
    return s + monthly;
  }, 0);
  const totalReachPlan = byCreator.reduce((s, c) => s + (c.reach_plan || 0), 0);
  // Считаем уникальные ролики из byCreator (дедуплицировано по post_id)
  const totalVideos = byCreator.reduce((s, c) => s + (c.total_videos || 0), 0);
  const reachPct = totalReachPlan > 0 ? Math.min(Math.round(allViews / totalReachPlan * 100), 100) : null;
  const videoPct = totalVideoPlan > 0 ? Math.min(Math.round(totalVideos / totalVideoPlan * 100), 100) : null;



  const filteredCreators = byCreator.filter(c => {
    if (!c.platforms) return false;
    return c.platforms.split(',').some(p => platforms.has(p));
  });

  return (
    <div className={styles.page}>
      <PageHeader title="Дашборд" subtitle="Сводная статистика по всем креаторам">
      </PageHeader>

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
                style={active ? { borderColor: color + '66', color } : {}}
                onClick={() => togglePlatform(p)}
              >
                <PlatformDot platform={p} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? <Loader /> : (
        <div className="fade-in">
          <div className={styles.metrics}>
            <MetricCard label="Просмотры" value={fmtNum(summary.total_views)} sub={`${totalVideos} роликов`} />
            <MetricCard label="Лайки" value={fmtNum(summary.total_likes)} />
            <MetricCard label="Комментарии" value={fmtNum(summary.total_comments)} />
            <MetricCard label="Сохранения" value={fmtNum(summary.total_saves)} />
            <MetricCard label="Репосты" value={fmtNum(summary.total_shares)} />
            {videoPct !== null && (
              <MetricCard
                label="Ролики план/факт"
                value={`${totalVideos} / ${totalVideoPlan}`}
                sub={`${videoPct}% выполнения`}
              />
            )}
            {reachPct !== null && (
              <MetricCard
                label="Охваты план/факт"
                value={`${fmtNum(allViews)} / ${fmtNum(totalReachPlan)}`}
                sub={`${reachPct}% выполнения`}
              />
            )}
          </div>

          {allViews > 0 && (
            <div className={styles.section} style={{ marginBottom: 28 }}>
              <h2 className={styles.sectionTitle}>Просмотры по платформам</h2>
              <div className={styles.platBreakdown}>
                {['youtube', 'tiktok', 'instagram'].map(p => {
                  const { label, color } = platformMeta(p);
                  const views = summaryByPlat[p]?.total_views || 0;
                  const pct = allViews > 0 ? Math.round(views / allViews * 100) : 0;
                  return (
                    <div key={p} className={styles.platBreakdownItem}>
                      <div className={styles.platBreakdownHeader}>
                        <span style={{ color, fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <PlatformDot platform={p} /> {label}
                        </span>
                        <span className={styles.mono} style={{ fontSize: 13 }}>{pct}%</span>
                      </div>
                      <div className={styles.platBreakdownBar}>
                        <div className={styles.platBreakdownFill} style={{ width: pct + '%', background: color }} />
                      </div>
                      <span className={styles.mono} style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtNum(views)} просмотров</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>По креаторам</h2>
            {filteredCreators.length === 0
              ? <Empty text="Нет данных за выбранный период" sub="Добавьте видео на странице «Видео»" />
              : (
                <div className={styles.creatorsTable}>
                  {(() => {
                    const hasVideoPlan = filteredCreators.some(c => (c.video_plan_period === 'week' ? (c.video_plan_count||0)*4 : (c.video_plan_count||0)) > 0);
                    const extraCols = hasVideoPlan ? ' 140px' : '';
                    const gridCols = `200px 130px${extraCols} 180px 100px 100px 80px 80px`;
                    return (
                      <>
                        <div className={styles.tableHead} style={{ gridTemplateColumns: gridCols }}>
                          <span>Креатор</span>
                          <span>Платф. / Роликов</span>
                          {hasVideoPlan && <span>Ролики план/факт</span>}
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

function CreatorRow({ creator: c, activePlatforms, onOpen, showVideoPlan, gridCols }) {
  const plats = c.platforms ? c.platforms.split(',').filter(p => activePlatforms.has(p)) : [];

  // Месячный план
  const monthPlan = c.video_plan_period === 'day'
    ? (c.video_plan_count || 0) * 30
    : c.video_plan_period === 'week'
    ? (c.video_plan_count || 0) * 4
    : (c.video_plan_count || 0);

  const videoPct = monthPlan > 0
    ? Math.min(Math.round((c.total_videos || 0) / monthPlan * 100), 100)
    : null;

  // Отставание по дате старта из воронки
  let behindStatus = null;
  if (monthPlan > 0 && c.period_start && c.video_plan_count > 0) {
    const start = new Date(c.period_start);
    const today = new Date();
    const daysPassed = Math.max(0, Math.floor((today - start) / 86400000));
    let expectedByNow;
    // daily_rate — сколько роликов в день по договорённости
    const ratePerDay = c.daily_rate > 0 ? c.daily_rate : null;
    if (ratePerDay) {
      expectedByNow = ratePerDay * daysPassed;
    } else if (monthPlan > 0) {
      expectedByNow = Math.round(monthPlan * Math.min(daysPassed, 30) / 30);
    }
    const behind = expectedByNow - (c.total_videos || 0);
    behindStatus = behind > 0 ? `−${behind} отстаёт` : 'в графике';
  }

  return (
    <div className={styles.tableRow} style={{ gridTemplateColumns: gridCols }}>
      {/* Креатор */}
      <div className={styles.creatorCell} onClick={onOpen} style={{ cursor: 'pointer' }}>
        <Avatar name={c.creator_name} color={c.avatar_color} size={30} />
        <span className={styles.creatorName} style={{ color: 'var(--accent)' }}>{c.creator_name}</span>
      </div>
      {/* Платформы / Роликов */}
      <div className={styles.platVideos}>
        <div className={styles.platDots}>{plats.map(p => <PlatformDot key={p} platform={p} />)}</div>
        <span className={styles.platCount}>{c.total_videos}</span>
      </div>
      {/* Ролики план/факт + % + статус */}
      {showVideoPlan && (
        <span className={styles.mono}>
          {monthPlan > 0 ? (
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <span>{c.total_videos || 0} / {monthPlan}</span>
              <span style={{ fontSize: 10, color: videoPct >= 100 ? '#4ade80' : videoPct >= 70 ? '#f59e0b' : 'var(--text3)' }}>
                {videoPct}%
              </span>
              {behindStatus && (
                <span style={{ fontSize: 10, color: behindStatus.includes('отстаёт') ? '#f87171' : '#4ade80' }}>
                  {behindStatus}
                </span>
              )}
            </span>
          ) : <span style={{ color: 'var(--text3)' }}>—</span>}
        </span>
      )}
      {/* Просмотры */}
      <span className={styles.mono}>{fmtNum(c.total_views)}</span>
      {/* Лайки */}
      <span className={styles.mono}>{fmtNum(c.total_likes)}</span>
      {/* Комм. */}
      <span className={styles.mono}>{fmtNum(c.total_comments)}</span>
      {/* Репосты */}
      <span className={styles.mono}>{c.total_shares ? fmtNum(c.total_shares) : <span className={styles.na}>—</span>}</span>
      {/* ER */}
      <span className={[styles.mono, styles.erVal].join(' ')}>{fmtEr(c.avg_er)}</span>
    </div>
  );
}

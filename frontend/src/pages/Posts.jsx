import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';
import { fmtNum, fmtEr, platformMeta, periodToDates } from '../lib/utils.js';
import { PageHeader, PeriodTabs, PlatformBadge, Avatar, Btn, Input, Select, Modal, Loader, Empty } from '../components/UI.jsx';
import styles from './Posts.module.css';

export default function Posts() {
  const [period, setPeriod] = useState('month');
  const [creatorId, setCreatorId] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [posts, setPosts] = useState([]);
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [addingVideoTo, setAddingVideoTo] = useState(null);

  const load = useCallback(async () => {
    if (period === 'custom' && !customFrom && !customTo) return;
    setLoading(true);
    try {
      const dates = periodToDates(period, customFrom, customTo);
      const [ps, crs] = await Promise.all([
        api.getPosts({ ...dates, creator_id: creatorId || undefined }),
        api.getCreators(),
      ]);
      setPosts(ps);
      setCreators(crs);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [period, creatorId, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);

  const handleDeletePost = async (id) => {
    if (!confirm('Удалить ролик и все его ссылки?')) return;
    await api.deletePost(id);
    setPosts(p => p.filter(x => x.id !== id));
  };

  const handleDeleteVideo = async (postId, videoId) => {
    if (!confirm('Удалить эту ссылку?')) return;
    await api.deleteVideoFromPost(postId, videoId);
    load();
  };

  return (
    <div className={styles.page}>
      <PageHeader title="Ролики" subtitle={`${posts.length} роликов за выбранный период`}>
        <Btn variant="primary" onClick={() => setShowAdd(true)}>+ Добавить ролик</Btn>
      </PageHeader>

      <div className={styles.toolbar}>
        <PeriodTabs value={period} onChange={setPeriod} customFrom={customFrom} customTo={customTo} onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }} />
        <select className={styles.filterSelect} value={creatorId} onChange={e => setCreatorId(e.target.value)}>
          <option value="">Все креаторы</option>
          {creators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? <Loader /> : posts.length === 0
        ? <Empty icon="🎬" text="Нет роликов за выбранный период" sub="Добавьте ролик и прикрепите к нему ссылки" />
        : (
          <div className={styles.list + ' fade-in'}>
            {posts.map((post, idx) => (
              <PostCard
                key={post.id}
                post={post}
                num={posts.length - idx}
                expanded={expandedId === post.id}
                onToggle={() => setExpandedId(expandedId === post.id ? null : post.id)}
                onDelete={() => handleDeletePost(post.id)}
                onAddVideo={() => setAddingVideoTo(post)}
                onDeleteVideo={(videoId) => handleDeleteVideo(post.id, videoId)}
              />
            ))}
          </div>
        )
      }

      {showAdd && (
        <AddPostModal
          creators={creators}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}
      {addingVideoTo && (
        <AddVideoModal
          post={addingVideoTo}
          onClose={() => setAddingVideoTo(null)}
          onSaved={() => { setAddingVideoTo(null); load(); }}
        />
      )}
    </div>
  );
}

function PostCard({ post, num, expanded, onToggle, onDelete, onAddVideo, onDeleteVideo }) {
  const { totals, videos } = post;
  const hasSaves = videos.some(v => v.saves != null);
  const hasShares = videos.some(v => v.shares != null);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader} onClick={onToggle}>
        <div className={styles.cardLeft}>
          <span className={styles.num}>#{num}</span>
          <Avatar name={post.creator_name} color={post.avatar_color} size={28} />
          <div className={styles.cardInfo}>
            <span className={styles.cardTitle}>{post.title || `Ролик ${num}`}</span>
            <span className={styles.cardMeta}>
              {post.creator_name}
              {post.published_at && <> · {post.published_at}</>}
              · {videos.length} {videos.length === 1 ? 'платформа' : videos.length < 5 ? 'платформы' : 'платформ'}
            </span>
          </div>
        </div>

        <div className={styles.cardStats}>
          <Stat label="Просмотры" value={fmtNum(totals.views)} />
          <Stat label="Лайки" value={fmtNum(totals.likes)} />
          <Stat label="Коммент." value={fmtNum(totals.comments)} />
          {hasSaves && <Stat label="Сохр." value={fmtNum(totals.saves)} />}
          {hasShares && <Stat label="Репосты" value={fmtNum(totals.shares)} />}
          <Stat label="ER" value={fmtEr(totals.avg_er)} accent />
        </div>

        <div className={styles.cardActions} onClick={e => e.stopPropagation()}>
          <button className={styles.iconBtn} onClick={onAddVideo} title="Добавить платформу">+</button>
          <button className={styles.iconBtn + ' ' + styles.del} onClick={onDelete} title="Удалить">✕</button>
          <span className={styles.chevron} style={{ transform: expanded ? 'rotate(180deg)' : '' }}>▾</span>
        </div>
      </div>

      {expanded && (
        <div className={styles.breakdown}>
          {videos.map(v => (
            <div key={v.id} className={styles.platformRow}>
              <PlatformBadge platform={v.platform} />
              <a href={v.url} target="_blank" rel="noopener noreferrer" className={styles.vidLink}>
                {v.title || v.url}
              </a>
              <div className={styles.platStats}>
                <PlatStat label="просм." value={fmtNum(v.views)} />
                <PlatStat label="лайки" value={fmtNum(v.likes)} />
                <PlatStat label="комм." value={fmtNum(v.comments)} />
                {v.saves != null && <PlatStat label="сохр." value={fmtNum(v.saves)} />}
                {v.shares != null && <PlatStat label="репост" value={fmtNum(v.shares)} />}
                <PlatStat label="ER" value={fmtEr(v.er)} accent />
              </div>
              <button className={styles.iconBtn + ' ' + styles.del} onClick={() => onDeleteVideo(v.id)} title="Удалить ссылку">✕</button>
            </div>
          ))}
          <button className={styles.addPlatBtn} onClick={onAddVideo}>
            + Добавить ещё платформу
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statVal + (accent ? ' ' + styles.accent : '')}>{value}</span>
    </div>
  );
}

function PlatStat({ label, value, accent }) {
  return (
    <span className={styles.platStat}>
      <span className={styles.platStatLabel}>{label}</span>
      <span className={styles.platStatVal + (accent ? ' ' + styles.accent : '')}>{value}</span>
    </span>
  );
}

function AddPostModal({ creators, onClose, onSaved }) {
  const [url, setUrl] = useState('');
  const [creatorId, setCreatorId] = useState(creators[0]?.id || '');
  const [publishedAt, setPublishedAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!url.trim()) return setError('Вставьте ссылку');
    if (!creatorId) return setError('Выберите креатора');
    setLoading(true);
    try {
      await api.createPost({ url: url.trim(), creator_id: parseInt(creatorId), published_at: publishedAt || undefined });
      onSaved();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="Новый ролик" onClose={onClose}>
      <p style={{ fontSize: 12, color: 'var(--text3)' }}>Добавьте первую ссылку — название подтянется автоматически. Остальные платформы можно добавить потом.</p>
      <Input label="Ссылка (YouTube / TikTok / Instagram)" placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} />
      <Select label="Креатор" value={creatorId} onChange={e => setCreatorId(e.target.value)}>
        {creators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
      <Input label="Дата публикации (необязательно)" type="date" value={publishedAt} onChange={e => setPublishedAt(e.target.value)} />
      {error && <p style={{ color: '#ff5050', fontSize: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn onClick={onClose}>Отмена</Btn>
        <Btn variant="primary" onClick={handleSave} loading={loading}>Добавить</Btn>
      </div>
    </Modal>
  );
}

function AddVideoModal({ post, onClose, onSaved }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const existingPlats = post.videos?.map(v => v.platform) || [];

  const handleSave = async () => {
    if (!url.trim()) return setError('Вставьте ссылку');
    setLoading(true);
    try {
      await api.addVideoToPost(post.id, { url: url.trim() });
      onSaved();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal title={`Добавить платформу к «${post.title || 'ролику'}»`} onClose={onClose} width={380}>
      {existingPlats.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--text3)' }}>
          Уже есть: {existingPlats.map(p => platformMeta(p).label).join(', ')}
        </p>
      )}
      <Input label="Ссылка на этот же ролик на другой платформе" placeholder="https://tiktok.com/..." value={url} onChange={e => setUrl(e.target.value)} />
      {error && <p style={{ color: '#ff5050', fontSize: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn onClick={onClose}>Отмена</Btn>
        <Btn variant="primary" onClick={handleSave} loading={loading}>Добавить</Btn>
      </div>
    </Modal>
  );
}

import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { fmtNum } from '../lib/utils.js';
import { PageHeader, Avatar, Btn, Input, Modal, Loader, Empty } from '../components/UI.jsx';
import styles from './Creators.module.css';

const COLORS = ['#7c6cfc','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#06b6d4','#f97316'];

export default function Creators() {
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setCreators(await api.getCreators()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Удалить креатора и все его видео?')) return;
    await api.deleteCreator(id);
    setCreators(c => c.filter(x => x.id !== id));
  };

  return (
    <div className={styles.page}>
      <PageHeader title="Креаторы" subtitle="Управление списком креаторов">
        <Btn variant="primary" onClick={() => setShowAdd(true)}>+ Добавить</Btn>
      </PageHeader>

      {loading ? <Loader /> : creators.length === 0
        ? <Empty icon="👤" text="Нет креаторов" sub="Добавьте первого креатора" />
        : (
          <div className={styles.grid + ' fade-in'}>
            {creators.map(c => (
              <div key={c.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <Avatar name={c.name} color={c.avatar_color} size={44} />
                  <div className={styles.cardInfo}>
                    <p className={styles.name}>{c.name}</p>
                    {c.username && <p className={styles.username}>@{c.username}</p>}
                  </div>
                  <div className={styles.cardActions}>
                    <button className={styles.iconBtn} onClick={() => setEditing(c)} title="Редактировать">✎</button>
                    <button className={styles.iconBtn + ' ' + styles.del} onClick={() => handleDelete(c.id)} title="Удалить">✕</button>
                  </div>
                </div>
                <div className={styles.colorDot} style={{ background: c.avatar_color }} />
              </div>
            ))}
          </div>
        )
      }

      {showAdd && (
        <CreatorModal
          title="Добавить креатора"
          colors={COLORS}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}
      {editing && (
        <CreatorModal
          title="Редактировать"
          initial={editing}
          colors={COLORS}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function CreatorModal({ title, initial, colors, onClose, onSaved }) {
  const [name, setName] = useState(initial?.name || '');
  const [username, setUsername] = useState(initial?.username || '');
  const [color, setColor] = useState(initial?.avatar_color || colors[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) return setError('Введите имя');
    setLoading(true);
    try {
      if (initial) {
        await api.updateCreator(initial.id, { name, username, avatar_color: color });
      } else {
        await api.createCreator({ name, username, avatar_color: color });
      }
      onSaved();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal title={title} onClose={onClose} width={360}>
      <Input label="Имя" placeholder="Анна К." value={name} onChange={e => setName(e.target.value)} />
      <Input label="Username (необязательно)" placeholder="@username" value={username} onChange={e => setUsername(e.target.value)} />
      <div>
        <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8, fontWeight: 500 }}>Цвет аватара</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {colors.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: 28, height: 28, borderRadius: 7, background: c,
                border: color === c ? '2px solid #fff' : '2px solid transparent',
                cursor: 'pointer', outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 1,
              }}
            />
          ))}
        </div>
      </div>
      {name && <Avatar name={name} color={color} size={40} />}
      {error && <p style={{ color: '#ff5050', fontSize: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn onClick={onClose}>Отмена</Btn>
        <Btn variant="primary" onClick={handleSave} loading={loading}>Сохранить</Btn>
      </div>
    </Modal>
  );
}

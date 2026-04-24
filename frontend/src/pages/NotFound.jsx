import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--bg)', color: 'var(--text)', gap: 16, textAlign: 'center',
      padding: '0 24px',
    }}>
      <div style={{ fontSize: 72, lineHeight: 1, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--border2)' }}>
        404
      </div>
      <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>
        Страница не найдена
      </div>
      <div style={{ fontSize: 13, color: 'var(--text3)', maxWidth: 320 }}>
        Возможно, ссылка устарела или вы допустили опечатку в адресе
      </div>
      <button
        onClick={() => navigate('/')}
        style={{
          marginTop: 8,
          padding: '10px 24px',
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font)',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        На главную
      </button>
    </div>
  );
}

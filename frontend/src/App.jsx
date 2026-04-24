import { BrowserRouter, Routes, Route, NavLink, Navigate, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import {
  LayoutGrid, PlayCircle, Link as LinkIcon, Users, BarChart2, Settings2, Sun, Moon,
} from 'lucide-react';

import Dashboard from './pages/Dashboard.jsx';
import Posts from './pages/Posts.jsx';
import Videos from './pages/Videos.jsx';
import Creators from './pages/Creators.jsx';
import CreatorDashboard from './pages/CreatorDashboard.jsx';
import Funnel from './pages/Funnel.jsx';
import Login from './pages/Login.jsx';
import Settings from './pages/Settings.jsx';
import Welcome from './pages/Welcome.jsx';
import NotFound from './pages/NotFound.jsx';
import Tutorial, { useTutorial } from './components/Tutorial.jsx';
import Onboarding from './pages/Onboarding.jsx';
import { api } from './lib/api.js';
import './App.css';

export const AuthContext = createContext(null);
export function useAuth() { return useContext(AuthContext); }

// ─── Theme ───────────────────────────────────────────────────────────────────
function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
  return [theme, toggle];
}

// ─── Trial banner ─────────────────────────────────────────────────────────────
function trialDaysLeft(workspace) {
  if (!workspace || workspace.plan !== 'trial') return null;
  if (!workspace.trial_ends_at) return 0;
  const diff = new Date(workspace.trial_ends_at) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function TrialBanner({ workspace }) {
  const days = trialDaysLeft(workspace);
  if (days === null) return null;
  const isExpired = days === 0;
  const bg = isExpired ? '#1a0000' : days <= 2 ? '#1a0d00' : 'rgba(255,106,0,0.08)';
  const border = isExpired ? 'rgba(239,68,68,0.3)' : '#ff6a00';
  const text = isExpired
    ? 'Пробный период закончился. Данные доступны только для чтения.'
    : `Пробный период: осталось ${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}`;
  return (
    <div style={{
      background: bg, borderBottom: `1px solid ${border}`,
      padding: '7px 24px', fontSize: 12, color: 'var(--text2)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      fontWeight: 500,
    }}>
      <span style={{ color: isExpired ? '#f87171' : '#ffaa60' }}>
        {isExpired ? '🔒' : '⏱'} {text}
      </span>
      {!isExpired && (
        <a href="/settings" style={{ color: '#ff6a00', fontWeight: 700, textDecoration: 'none', fontSize: 11 }}>
          Выбрать тариф →
        </a>
      )}
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Apply saved theme immediately
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);

    api.getMe().then(data => {
      setAuth(data);
      if (data?.workspaces?.length > 0) api.setWorkspace(data.workspaces[0].id);
    }).catch(() => setAuth(false)).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ width: 22, height: 22, border: '2px solid rgba(255,255,255,0.1)', borderTop: '2px solid #ff6a00', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ auth, setAuth }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={!auth ? <Login /> : <Navigate to="/" />} />
          <Route path="/onboarding" element={auth && auth.workspaces?.length === 0 ? <Welcome /> : <Navigate to="/" />} />
          <Route path="/invite/:token" element={<InviteHandler />} />
          <Route path="/404" element={<NotFound />} />
          <Route path="/*" element={
            !auth ? <Navigate to="/login" /> :
            auth.workspaces?.length === 0 ? <Navigate to="/onboarding" /> :
            <AppLayout auth={auth} />
          } />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

function AppLayout({ auth }) {
  const workspace = auth?.workspaces?.[0];
  const role = workspace?.role;
  const isOwner = role === 'owner';
  const isManager = role === 'manager' || isOwner;
  const [showTutorial, closeTutorial] = useTutorial(role);
  const [theme, toggleTheme] = useTheme();

  return (
    <div className="app-layout">
      <TrialBanner workspace={workspace} />
      <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="1" y="1" width="8.5" height="8.5" rx="2.5" fill="#ff6a00" opacity="0.9"/>
              <rect x="12" y="1" width="8.5" height="8.5" rx="2.5" fill="#ff6a00" opacity="0.45"/>
              <rect x="1" y="12" width="8.5" height="8.5" rx="2.5" fill="#ff6a00" opacity="0.45"/>
              <rect x="12" y="12" width="8.5" height="8.5" rx="2.5" fill="#ff6a00" opacity="0.7"/>
            </svg>
            <span>Creator Stats</span>
          </div>
          <nav>
            <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <LayoutGrid size={16} strokeWidth={1.2} /> Дашборд
            </NavLink>
            <NavLink to="/posts" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <PlayCircle size={16} strokeWidth={1.2} /> Ролики
            </NavLink>
            <NavLink to="/videos" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <LinkIcon size={16} strokeWidth={1.2} /> Все ссылки
            </NavLink>
            {isManager && (
              <NavLink to="/creators" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                <Users size={16} strokeWidth={1.2} /> Креаторы
              </NavLink>
            )}
            <NavLink to="/funnel" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <BarChart2 size={16} strokeWidth={1.2} /> Воронка
            </NavLink>
          </nav>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 4, padding: '0 0 4px' }}>
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 11px', borderRadius: 10, border: 'none',
                background: 'transparent', cursor: 'pointer',
                color: 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: 500,
                fontFamily: 'var(--font)', transition: 'all 150ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
            >
              {theme === 'dark'
                ? <Sun size={16} strokeWidth={1.2} style={{ stroke: 'rgba(255,255,255,0.2)' }} />
                : <Moon size={16} strokeWidth={1.2} style={{ stroke: 'rgba(255,255,255,0.2)' }} />
              }
              {theme === 'dark' ? 'Светлая' : 'Тёмная'}
            </button>

            <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
              <Settings2 size={16} strokeWidth={1.2} />
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{auth?.user?.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400 }}>Настройки</div>
              </div>
              {auth?.user?.avatar && (
                <img src={auth.user.avatar} style={{ width: 22, height: 22, borderRadius: '50%', marginLeft: 'auto', flexShrink: 0 }} alt="" />
              )}
            </NavLink>
          </div>
        </aside>

        {showTutorial && <Tutorial role={role} onClose={closeTutorial} />}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/posts" element={<Posts />} />
            <Route path="/videos" element={<Videos />} />
            <Route path="/creators" element={isManager ? <Creators /> : <Navigate to="/" />} />
            <Route path="/creator/:id" element={<CreatorDashboard />} />
            <Route path="/funnel" element={<Funnel />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function InviteHandler() {
  const { token } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    api.joinWorkspace(token).then(() => navigate('/')).catch(() => navigate('/login'));
  }, []);
  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontFamily: 'var(--font)' }}>
      Присоединяемся…
    </div>
  );
}

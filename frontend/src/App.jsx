import { BrowserRouter, Routes, Route, NavLink, Navigate, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
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

// Сколько дней осталось до конца триала
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
  const bg = isExpired ? '#7f1d1d' : days <= 2 ? '#78350f' : '#1e3a5f';
  const border = isExpired ? '#ef4444' : days <= 2 ? '#f59e0b' : '#3b82f6';
  const text = isExpired
    ? 'Пробный период закончился. Данные доступны только для чтения.'
    : `Пробный период: осталось ${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}`;

  return (
    <div style={{
      background: bg, borderBottom: `1px solid ${border}`,
      padding: '7px 24px', fontSize: 12, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <span>{isExpired ? '🔒' : '⏱'} {text}</span>
      {!isExpired && (
        <a href="/settings" style={{ color: border, fontWeight: 600, textDecoration: 'none', fontSize: 11 }}>
          Выбрать тариф →
        </a>
      )}
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMe().then(data => {
      setAuth(data);
      if (data?.workspaces?.length > 0) {
        api.setWorkspace(data.workspaces[0].id);
      }
    }).catch(() => {
      setAuth(false);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ width: 20, height: 20, border: '2px solid var(--border2)', borderTop: '2px solid var(--accent)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
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

  return (
    <div className="app-layout" style={{ flexDirection: 'column' }}>
      <TrialBanner workspace={workspace} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <aside className="sidebar">
          <div className="sidebar-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="2" width="9" height="9" rx="2" fill="var(--accent)" opacity="0.9"/>
              <rect x="13" y="2" width="9" height="9" rx="2" fill="var(--accent)" opacity="0.5"/>
              <rect x="2" y="13" width="9" height="9" rx="2" fill="var(--accent)" opacity="0.5"/>
              <rect x="13" y="13" width="9" height="9" rx="2" fill="var(--accent)" opacity="0.7"/>
            </svg>
            <span>{workspace?.name || 'Creator Stats'}</span>
          </div>
          <nav>
            <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <IconChart /> Дашборд
            </NavLink>
            <NavLink to="/posts" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <IconFilm /> Ролики
            </NavLink>
            <NavLink to="/videos" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <IconVideo /> Все ссылки
            </NavLink>
            {isManager && (
              <NavLink to="/creators" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                <IconUsers /> Креаторы
              </NavLink>
            )}
            <NavLink to="/funnel" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <IconFunnel /> Воронка
            </NavLink>
          </nav>
          <div style={{ marginTop: 'auto', padding: '0 8px' }}>
            <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 12 }}>
              <IconSettings />
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 500, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{auth?.user?.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>Настройки</div>
              </div>
              {auth?.user?.avatar && <img src={auth.user.avatar} style={{ width: 22, height: 22, borderRadius: '50%', marginLeft: 'auto', flexShrink: 0 }} />}
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
  return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Присоединяемся...</div>;
}

function IconChart() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="8" width="3" height="7" rx="1"/><rect x="6" y="4" width="3" height="11" rx="1"/><rect x="11" y="1" width="3" height="14" rx="1"/></svg>; }
function IconFilm() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="2" width="14" height="12" rx="2"/><line x1="5" y1="2" x2="5" y2="14"/><line x1="11" y1="2" x2="11" y2="14"/><line x1="1" y1="6" x2="5" y2="6"/><line x1="11" y1="6" x2="15" y2="6"/><line x1="1" y1="10" x2="5" y2="10"/><line x1="11" y1="10" x2="15" y2="10"/></svg>; }
function IconVideo() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="3" width="10" height="10" rx="2"/><path d="M11 6l4-2v8l-4-2V6z"/></svg>; }
function IconUsers() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="5" r="3"/><path d="M1 14c0-3 2-5 5-5s5 2 5 5"/><circle cx="12" cy="5" r="2"/><path d="M14 14c0-2-1-3.5-2-4"/></svg>; }
function IconFunnel() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 2h12l-4.5 6v5l-3-1.5V8L2 2z"/></svg>; }
function IconSettings() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/></svg>; }

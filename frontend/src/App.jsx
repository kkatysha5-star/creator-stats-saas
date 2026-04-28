import { BrowserRouter, Routes, Route, NavLink, Navigate, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import {
  LayoutGrid, PlayCircle, Link as LinkIcon, Users, BarChart2, Settings2, Sun, Moon, Lock, Clock,
} from 'lucide-react';

import Dashboard from './pages/Dashboard.jsx';
import Posts from './pages/Posts.jsx';
import Videos from './pages/Videos.jsx';
import Creators from './pages/Creators.jsx';
import CreatorDashboard from './pages/CreatorDashboard.jsx';
import Funnel from './pages/Funnel.jsx';
import Checkout from './pages/Checkout.jsx';
import Login from './pages/Login.jsx';
import Settings from './pages/Settings.jsx';
import Welcome from './pages/Welcome.jsx';
import NotFound from './pages/NotFound.jsx';
import Tutorial, { useTutorial } from './components/Tutorial.jsx';
import Onboarding from './pages/Onboarding.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Invite from './pages/Invite.jsx';
import { api } from './lib/api.js';
import { ToastProvider } from './components/UI.jsx';
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
      <span style={{ color: isExpired ? '#f87171' : '#ffaa60', display: 'flex', alignItems: 'center', gap: 6 }}>
        {isExpired
          ? <Lock size={12} strokeWidth={2} style={{ flexShrink: 0 }} />
          : <Clock size={12} strokeWidth={2} style={{ flexShrink: 0 }} />}
        {text}
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
      <ToastProvider />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={!auth ? <Login /> : <Navigate to="/" />} />
          <Route path="/onboarding" element={auth && auth.workspaces?.length === 0 ? <Welcome /> : <Navigate to="/" />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/invite/:token" element={<Invite />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/reset-password" element={<ResetPassword />} />
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

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark';
  return (
    <button
      onClick={onToggle}
      className="theme-toggle"
      title={isDark ? 'Светлая тема' : 'Тёмная тема'}
      aria-label="Переключить тему"
    >
      <Moon size={13} strokeWidth={1.5} className="toggle-icon toggle-moon" />
      <span className={`toggle-track ${isDark ? '' : 'toggle-track-light'}`}>
        <span className={`toggle-thumb ${isDark ? '' : 'toggle-thumb-right'}`} />
      </span>
      <Sun size={13} strokeWidth={1.5} className="toggle-icon toggle-sun" />
      <span className="toggle-label">{isDark ? 'Тёмная' : 'Светлая'}</span>
    </button>
  );
}

function EmailVerifyBanner({ user, setAuth }) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  if (!user || user.email_verified) return null;

  const resend = async () => {
    setLoading(true);
    try { await api.resendVerify(); setSent(true); } catch {}
    finally { setLoading(false); }
  };

  return (
    <div style={{
      background: 'rgba(245,158,11,0.1)', borderBottom: '1px solid rgba(245,158,11,0.3)',
      padding: '8px 24px', fontSize: 12, color: 'var(--text2)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
    }}>
      <span style={{ color: '#f59e0b' }}>
        ⚠️ Подтвердите почту для полного доступа. Письмо отправлено на <strong>{user.email}</strong>
      </span>
      <button
        onClick={resend}
        disabled={loading || sent}
        style={{ background: 'none', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 100, color: '#f59e0b', fontFamily: 'var(--font)', fontSize: 11, fontWeight: 600, padding: '4px 12px', cursor: sent ? 'default' : 'pointer', opacity: sent ? 0.7 : 1 }}
      >
        {sent ? '✓ Отправлено' : loading ? '…' : 'Отправить повторно'}
      </button>
    </div>
  );
}

function AppLayout({ auth }) {
  const workspace = auth?.workspaces?.[0];
  const role = workspace?.role;
  const isOwner = role === 'owner';
  const isManager = role === 'manager' || isOwner;
  const isPro = workspace?.plan === 'pro';
  const [showTutorial, closeTutorial] = useTutorial(role);
  const [theme, toggleTheme] = useTheme();
  const { setAuth } = useAuth();

  // Воронка: owner всегда (upsell если не pro), остальные только если pro+разрешено
  const canSeeFunnel = isOwner || (isPro && !!workspace?.creator_sees_funnel);
  // Раздел Креаторы: manager/owner + creator если разрешено настройками
  const canSeeCreators = isManager
    || !!workspace?.creator_sees_all_creators
    || !!workspace?.creator_sees_own_only;

  return (
    <div className="app-layout">
      <EmailVerifyBanner user={auth?.user} setAuth={setAuth} />
      <TrialBanner workspace={workspace} />
      <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div style={{background:'#ff6a00',borderRadius:'10px',width:'40px',height:'40px',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:700,fontSize:'16px'}}>КМ</div>
            <span>КонтентМетрика</span>
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
            {canSeeCreators && (
              <NavLink to="/creators" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                <Users size={16} strokeWidth={1.2} /> Креаторы
              </NavLink>
            )}
            {canSeeFunnel && (
              <NavLink to="/funnel" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                <BarChart2 size={16} strokeWidth={1.2} /> Воронка
              </NavLink>
            )}
            {/* Settings — в nav чтобы не вываливаться из flex-ряда на мобиле */}
            <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-item active nav-settings' : 'nav-item nav-settings'}>
              <Settings2 size={16} strokeWidth={1.2} />
              <div style={{ overflow: 'hidden', flex: 1 }} className="nav-settings-label">
                <div style={{ fontSize: 12, fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{auth?.user?.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400 }}>Настройки</div>
              </div>
              {auth?.user?.avatar && (
                <img src={auth.user.avatar} style={{ width: 22, height: 22, borderRadius: '50%', marginLeft: 'auto', flexShrink: 0 }} className="nav-settings-avatar" alt="" />
              )}
              <span className="nav-settings-mobile-label">Настройки</span>
            </NavLink>
          </nav>

          <div className="sidebar-bottom">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </aside>

        {showTutorial && <Tutorial role={role} onClose={closeTutorial} />}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/posts" element={<Posts />} />
            <Route path="/videos" element={<Videos />} />
            <Route path="/creators" element={canSeeCreators ? <Creators /> : <Navigate to="/" />} />
            <Route path="/creator/:id" element={<CreatorDashboard />} />
            <Route path="/funnel" element={canSeeFunnel ? <Funnel /> : <Navigate to="/" />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}


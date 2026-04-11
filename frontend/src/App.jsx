import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Posts from './pages/Posts.jsx';
import Videos from './pages/Videos.jsx';
import Creators from './pages/Creators.jsx';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="2" width="9" height="9" rx="2" fill="var(--accent)" opacity="0.9"/>
              <rect x="13" y="2" width="9" height="9" rx="2" fill="var(--accent)" opacity="0.5"/>
              <rect x="2" y="13" width="9" height="9" rx="2" fill="var(--accent)" opacity="0.5"/>
              <rect x="13" y="13" width="9" height="9" rx="2" fill="var(--accent)" opacity="0.7"/>
            </svg>
            <span>Creator Stats</span>
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
            <NavLink to="/creators" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <IconUsers /> Креаторы
            </NavLink>
          </nav>
        </aside>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/posts" element={<Posts />} />
            <Route path="/videos" element={<Videos />} />
            <Route path="/creators" element={<Creators />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function IconChart() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="8" width="3" height="7" rx="1"/><rect x="6" y="4" width="3" height="11" rx="1"/><rect x="11" y="1" width="3" height="14" rx="1"/></svg>;
}
function IconFilm() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="2" width="14" height="12" rx="2"/><line x1="5" y1="2" x2="5" y2="14"/><line x1="11" y1="2" x2="11" y2="14"/><line x1="1" y1="6" x2="5" y2="6"/><line x1="11" y1="6" x2="15" y2="6"/><line x1="1" y1="10" x2="5" y2="10"/><line x1="11" y1="10" x2="15" y2="10"/></svg>;
}
function IconVideo() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="3" width="10" height="10" rx="2"/><path d="M11 6l4-2v8l-4-2V6z"/></svg>;
}
function IconUsers() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="5" r="3"/><path d="M1 14c0-3 2-5 5-5s5 2 5 5"/><circle cx="12" cy="5" r="2"/><path d="M14 14c0-2-1-3.5-2-4"/></svg>;
}

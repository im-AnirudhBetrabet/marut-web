import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingBasket, Sprout, UsersRound, MessageSquareText, ChartNoAxesColumn, Settings, Search, Sun, Moon, Bell, Menu, LogOut, ArrowUpRight } from 'lucide-react';

const navItems = [
    { label: 'Dashboard', to: '/', icon: LayoutDashboard, end: true },
    { label: 'Orders', to: '/orders', icon: ShoppingBasket, count: '8' },
    { label: 'Products', to: '/products', icon: Sprout },
    { label: 'Customers', to: '/customers', icon: UsersRound },
    { label: 'Feedback', to: '/feedback', icon: MessageSquareText, count: '3' },
    { label: 'Reports', to: '/reports', icon: ChartNoAxesColumn },
];

export default function AppLayout({ theme, setTheme, onSignOut }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [search, setSearch] = useState('');
    const location = useLocation();
    const current = navItems.find(item => item.to === location.pathname)?.label || (location.pathname === '/settings' ? 'Settings' : 'Overview');

    useEffect(() => setSidebarOpen(false), [location.pathname]);

    return (
        <div className="admin-shell">
            {sidebarOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <NavLink className="sidebar-brand" to="/" aria-label="MARUT Admin home">
                    <img className="sidebar-logo sidebar-logo-gold" src="/assets/marut-logo-gold.png" alt="MARUT" />
                    <img className="sidebar-logo sidebar-logo-dark" src="/assets/marut-logo-dark.png" alt="MARUT" />
                    <span>ADMIN STUDIO</span>
                </NavLink>
                <div className="workspace-label">WORKSPACE</div>
                <nav className="nav-list" aria-label="Main navigation">
                    {navItems.map(({ label, to, icon: Icon, count, end }) => (
                        <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                            <Icon className="nav-icon" size={17} strokeWidth={1.65} />
                            <span>{label}</span>
                            {count && <span className="nav-count">{count}</span>}
                        </NavLink>
                    ))}
                </nav>
                <div className="sidebar-bottom">
                    <div className="workspace-label">PREFERENCES</div>
                    <NavLink to="/settings" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}><Settings className="nav-icon" size={17} strokeWidth={1.65} /><span>Settings</span></NavLink>
                    <div className="profile-card">
                        <div className="avatar">A</div>
                        <div className="profile-copy"><strong>MARUT Admin</strong><span>Workspace owner · demo</span></div>
                    </div>
                    <button className="logout" onClick={onSignOut}><LogOut size={16} /> Sign out</button>
                </div>
            </aside>

            <main className="main-area">
                <header className="topbar">
                    <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
                    <div className="breadcrumb"><span>MARUT</span><i>/</i><strong>{current === 'Dashboard' ? 'Overview' : current}</strong></div>
                    <div className="topbar-actions">
                        <label className="searchbox"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search anything…" aria-label="Search dashboard" /><kbd>⌘ K</kbd></label>
                        <button className="icon-button notification-button" onClick={() => window.dispatchEvent(new CustomEvent('marut-toast', { detail: 'You’re all caught up on this demo.' }))} aria-label="Notifications"><Bell size={18} /><span className="notification-dot" /></button>

                        <button
                            className="theme-toggle"
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                            aria-pressed={theme === 'light'}
                            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                        >
                            <Sun size={15} />
                            <Moon size={15} />
                            <span className="toggle-knob" />
                        </button>

                        <div className="avatar top-avatar">A</div>
                    </div>
                </header>
                <Outlet context={{ search }} />
            </main>
            <ToastHost />
        </div>
    );
}

function ToastHost() {
    const [message, setMessage] = useState('');
    useEffect(() => {
        const onToast = (event) => {
            setMessage(event.detail || '');
            window.setTimeout(() => setMessage(''), 2800);
        };
        window.addEventListener('marut-toast', onToast);
        return () => window.removeEventListener('marut-toast', onToast);
    }, []);
    return message ? <div className="toast"><span>✳</span>{message}</div> : null;
}

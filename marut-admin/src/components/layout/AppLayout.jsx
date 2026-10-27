import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    ShoppingBasket,
    Sprout,
    UsersRound,
    MessageSquareText,
    ChartNoAxesColumn,
    Settings,
    Search,
    Sun,
    Moon,
    Bell,
    Menu,
    LogOut,
} from 'lucide-react';

const navItems = [
    { label: 'Dashboard', to: '/', icon: LayoutDashboard, end: true },
    { label: 'Orders', to: '/orders', icon: ShoppingBasket, count: '8' },
    { label: 'Products', to: '/products', icon: Sprout },
    { label: 'Customers', to: '/customers', icon: UsersRound },
    { label: 'Feedback', to: '/feedback', icon: MessageSquareText, count: '3' },
    { label: 'Reports', to: '/reports', icon: ChartNoAxesColumn },
];

function getDisplayName(user) {
    const metadata = user?.user_metadata ?? {};
    const name = metadata.full_name || metadata.name || metadata.display_name;
    if (typeof name === 'string' && name.trim()) return name.trim();

    // Do not infer a person's role from their email address.
    return 'MARUT Admin';
}

function getInitial(user, displayName) {
    const source = displayName !== 'MARUT Admin' ? displayName : user?.email;
    return typeof source === 'string' && source.trim()
        ? source.trim().charAt(0).toUpperCase()
        : 'M';
}

export default function AppLayout({ theme, setTheme, onSignOut, user }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [search, setSearch] = useState('');
    const location = useLocation();

    const current = navItems.find((item) => item.to === location.pathname)?.label
        || (location.pathname === '/settings' ? 'Settings' : 'Overview');
    const displayName = getDisplayName(user);
    const initial = getInitial(user, displayName);
    const email = user?.email || '';

    useEffect(() => setSidebarOpen(false), [location.pathname]);

    const toggleSidebar = () => {
        if (window.matchMedia('(max-width: 700px)').matches) {
            setSidebarOpen((open) => !open);
        } else {
            setSidebarCollapsed((collapsed) => !collapsed);
        }
    };

    return (
        <div className="admin-shell">
            {sidebarOpen && (
                <button
                    className="mobile-scrim"
                    aria-label="Close navigation"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <aside
                className={`sidebar${sidebarOpen ? ' open' : ''}${sidebarCollapsed ? ' collapsed' : ''}`}
                aria-label="Sidebar navigation"
            >
                <NavLink className="sidebar-brand" to="/" aria-label="MARUT Admin home">
                    <img className="sidebar-logo sidebar-logo-gold" src="/assets/marut-logo-gold.png" alt="MARUT" />
                    <img className="sidebar-logo sidebar-logo-dark" src="/assets/marut-logo-dark.png" alt="MARUT" />
                    <span>ADMIN STUDIO</span>
                </NavLink>

                <div className="workspace-label">WORKSPACE</div>
                <nav className="nav-list" aria-label="Main navigation">
                    {navItems.map(({ label, to, icon: Icon, count, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            title={sidebarCollapsed ? label : undefined}
                            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                        >
                            <Icon className="nav-icon" size={17} strokeWidth={1.65} />
                            <span>{label}</span>
                            {count && <span className="nav-count">{count}</span>}
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-bottom">
                    <div className="workspace-label">PREFERENCES</div>
                    <NavLink
                        to="/settings"
                        title={sidebarCollapsed ? 'Settings' : undefined}
                        className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                    >
                        <Settings className="nav-icon" size={17} strokeWidth={1.65} />
                        <span>Settings</span>
                    </NavLink>

                    <div className="profile-card" title={email || displayName}>
                        <div className="avatar" aria-hidden="true">{initial}</div>
                        <div className="profile-copy">
                            <strong>{displayName}</strong>
                            <span>{email || 'Authorized administrator'}</span>
                        </div>
                    </div>

                    <button className="logout" type="button" onClick={onSignOut}>
                        <LogOut size={16} />
                        <span>Sign out</span>
                    </button>
                </div>
            </aside>

            <main className="main-area">
                <header className="topbar">
                    <button
                        className="icon-button mobile-menu"
                        type="button"
                        onClick={toggleSidebar}
                        aria-label={sidebarOpen ? 'Close navigation' : sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        aria-expanded={window.matchMedia('(max-width: 700px)').matches ? sidebarOpen : !sidebarCollapsed}
                        title={window.matchMedia('(max-width: 700px)').matches ? 'Toggle navigation' : sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        <Menu size={19} strokeWidth={1.8} />
                    </button>

                    <div className="breadcrumb">
                        <span>MARUT</span><i>/</i>
                        <strong>{current === 'Dashboard' ? 'Overview' : current}</strong>
                    </div>

                    <div className="topbar-actions">
                        <label className="searchbox">
                            <Search size={16} />
                            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search anything…" aria-label="Search dashboard" />
                            <kbd>⌘ K</kbd>
                        </label>

                        <button
                            className="icon-button notification-button"
                            type="button"
                            onClick={() => window.dispatchEvent(new CustomEvent('marut-toast', { detail: 'You’re all caught up.' }))}
                            aria-label="Notifications"
                        >
                            <Bell size={18} /><span className="notification-dot" />
                        </button>

                        <button
                            className="theme-toggle"
                            type="button"
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                            aria-pressed={theme === 'light'}
                            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                        >
                            <Sun size={15} />
                            <Moon size={15} />
                            <span className="toggle-knob" />
                        </button>

                        <div className="avatar top-avatar" title={email || displayName} aria-label={displayName}>
                            {initial}
                        </div>
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

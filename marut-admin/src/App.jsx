
import { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AppLayout from './components/layout/AppLayout.jsx';
import { supabase } from './lib/supabase';
const SESSION_KEY = 'marut-admin-demo-session';
const SESSION_DURATION = 8 * 60 * 60 * 1000;

function getValidSession() {
  try {
    const session = sessionStorage.getItem(SESSION_KEY);

    if (!session) return false;

    const parsed = JSON.parse(session);

    if (
      !parsed.expiresAt ||
      Date.now() >= parsed.expiresAt
    ) {
      sessionStorage.removeItem(SESSION_KEY);
      return false;
    }

    return true;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return false;
  }
}

function App() {
  const [authenticated, setAuthenticated] = useState(
    getValidSession
  );
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
      let mounted = true;

      supabase.auth.getSession().then(({ data, error }) => {
          if (!mounted) return;

          setSession(error ? null : data.session);
          setAuthLoading(false);
      });

      const {
          data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, newSession) => {
          setSession(newSession);
          setAuthLoading(false);
      });

      return () => {
          mounted = false;
          subscription.unsubscribe();
      };
  }, []);
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('marut-admin-theme');
      return saved === 'light' || saved === 'dark'
        ? saved
        : 'dark';
    } catch {
      return 'dark';
    }
  });

  const location = useLocation();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    try {
      localStorage.setItem('marut-admin-theme', theme);
    } catch {
      // Theme preference storage may be unavailable.
    }
  }, [theme]);

  // Recheck the demo session whenever the page becomes active.
  useEffect(() => {
    const checkSession = () => {
      if (!getValidSession()) {
        setAuthenticated(false);
      }
    };

    window.addEventListener('focus', checkSession);
    document.addEventListener('visibilitychange', checkSession);

    return () => {
      window.removeEventListener('focus', checkSession);
      document.removeEventListener(
        'visibilitychange',
        checkSession
      );
    };
  }, []);

  const signInDemo = () => {
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          expiresAt: Date.now() + SESSION_DURATION,
        })
      );

      setAuthenticated(true);
    } catch {
      // Do not enter the dashboard if session storage fails.
      setAuthenticated(false);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
        console.error('Sign-out failed:', error.message);
    }
  };

  // All unauthenticated routes return to the root login screen.
  if (!authenticated && location.pathname !== '/') {
    return <Navigate to="/" replace />;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          authenticated ? (
            <AppLayout
              theme={theme}
              setTheme={setTheme}
              onSignOut={signOut}
            />
          ) : (
            <Login
              theme={theme}
              setTheme={setTheme}
              onDemoSignIn={signInDemo}
            />
          )
        }
      >
        <Route index element={<Dashboard />} />

        <Route
          path="orders"
          element={
            <Placeholder
              title="Orders"
              description="Manual orders, fulfilment and status updates will live here."
            />
          }
        />

        <Route
          path="products"
          element={
            <Placeholder
              title="Products"
              description="Manage the MARUT catalogue, pack sizes and pricing."
            />
          }
        />

        <Route
          path="customers"
          element={
            <Placeholder
              title="Customers"
              description="Customer profiles and order history."
            />
          }
        />

        <Route
          path="feedback"
          element={
            <Placeholder
              title="Feedback"
              description="Review customer feedback and follow-up items."
            />
          }
        />

        <Route
          path="reports"
          element={
            <Placeholder
              title="Reports"
              description="Sales, order trends and customer activity."
            />
          }
        />

        <Route
          path="settings"
          element={
            <Placeholder
              title="Settings"
              description="Workspace preferences and admin permissions."
            />
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function Placeholder({ title, description }) {
  return (
    <section className="placeholder-page reveal">
      <span className="eyebrow">
        <span className="eyebrow-line" />
        MARUT WORKSPACE
      </span>

      <h1>
        {title}
        <em>, with care.</em>
      </h1>

      <p>{description}</p>

      <div className="placeholder-panel">
        <span className="placeholder-mark">✳</span>

        <div>
          <strong>{title} screen coming next</strong>
          <p>
            We’ll design and implement this screen before
            connecting it to the API.
          </p>
        </div>
      </div>
    </section>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}

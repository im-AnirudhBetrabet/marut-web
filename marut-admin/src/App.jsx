import { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import Login        from './pages/Login.jsx';
import Dashboard    from './pages/Dashboard.jsx';
import AppLayout    from './components/layout/AppLayout.jsx';
import { supabase } from './lib/supabase';
import SetPassword  from './pages/SetPassword/SetPassword.jsx';
import Admins       from './pages/Admins/Admins.jsx'
import Products     from './pages/Products/Products.jsx';
import SettingsPage from './pages/Settings/Settings.jsx';
import Feedback     from './pages/Feedback/Feedback.jsx';

import Customers, { CustomerProfile } from './pages/Customers/Customers.jsx';



function App() {
  const [session    , setSession    ] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

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

  // Supabase is the single source of truth for authentication.
  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;

      setSession(newSession);
      setAuthLoading(false);
    });

    // Check for an existing Supabase session.
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;

        if (error) {
          console.error(
            'Failed to retrieve session:',
            error.message
          );
          setSession(null);
        } else {
          setSession(data.session);
        }

        setAuthLoading(false);
      })
      .catch((error) => {
        if (!mounted) return;

        console.error('Session check failed:', error);
        setSession(null);
        setAuthLoading(false);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Persist the theme preference.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    try {
      localStorage.setItem('marut-admin-theme', theme);
    } catch {
      // Theme preference storage may be unavailable.
    }
  }, [theme]);

  // Refresh the session after a successful login if needed.
  const handleSignIn = async () => {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error(
        'Failed to retrieve session after login:',
        error.message
      );
      return;
    }

    setSession(data.session);
  };

  // Sign out of Supabase.
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Sign-out failed:', error.message);
      return;
    }

    // The auth state listener will set session to null.
    setSession(null);
  };

  const authenticated = Boolean(session);

  // Prevent the login screen from flashing while checking the session.
  if (authLoading) {
    return (
      <div className="auth-loading">
        <p>Loading MARUT workspace...</p>
      </div>
    );
  }

  // Protect all dashboard routes.
  if (!authenticated && location.pathname !== '/') {
    return <Navigate to="/" replace />;
  }

  const isPublicRoute = location.pathname === '/' || location.pathname === '/set-password';

  if (!authenticated && !isPublicRoute) {
    return <Navigate to="/" replace />;
  }

  return (
    <Routes>
      <Route
        path="/set-password"
        element={<SetPassword />}
      />
      <Route
        path="/"
        element={
          authenticated ? (
            <AppLayout
              theme={theme}
              setTheme={setTheme}
              onSignOut={signOut}
              user={session?.user}
            />
          ) : (
            <Login
              theme={theme}
              setTheme={setTheme}
              onSignIn={handleSignIn}
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

        <Route path="products"      element={<Products/>}         />
        <Route path="customers"     element={<Customers/>}        />
        <Route path="customers/:id" element={<CustomerProfile />} />
        <Route path="feedback"      element={<Feedback/>}         />
        <Route path="feedback/:id"  element={<Feedback />}        />

        <Route
          path="reports"
          element={
            <Placeholder
              title="Reports"
              description="Sales, order trends and customer activity."
            />
          }
        />

        <Route path="settings" element={<SettingsPage/>}/>
        <Route path="admins"   element={<Admins />     }/>
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

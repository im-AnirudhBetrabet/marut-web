
import { useState } from 'react';
import {
    Moon,
    Sun,
    Leaf,
    LockKeyhole,
    Mail,
    Eye,
    EyeOff,
    ArrowRight,
    ShieldCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export default function Login({ theme, setTheme, onDemoSignIn }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [step, setStep] = useState('email');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const continueWithEmail = async (event) => {
        event.preventDefault();
        setError('');

        const normalized = email.trim().toLowerCase();

        // Basic frontend validation before calling the backend.
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
            setError('Enter a valid email address to continue.');
            return;
        }

        setBusy(true);

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/v1/auth/check-email`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: normalized,
                    }),
                }
            );

            let data = {};

            try {
                data = await response.json();
            } catch {
                // The server may return an empty or non-JSON response.
            }

            if (response.status === 200 && data.authorized === true) {
                setEmail(normalized);
                setPassword('');
                setError('');
                setStep('password');
                return;
            }

            if (response.status === 403) {
                setError(
                    data.error ||
                    'This account is not authorized to access MARUT Admin'
                );
                return;
            }

            setError(
                data.error ||
                'Unable to verify your email right now. Please try again.'
            );
        } catch {
            setError(
                'Unable to connect to MARUT Admin. Check your connection and try again.'
            );
        } finally {
            setBusy(false);
        }
    };

    const signIn = async (event) => {
        event.preventDefault();
        setError('');

        if (!password) {
            setError('Enter your password to continue.');
            return;
        }

        setBusy(true);

        try {
            const { data, error: authError } =
                await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

            if (authError) {
                setError(
                    authError.message === 'Invalid login credentials'
                        ? 'Incorrect email or password. Please try again.'
                        : 'Unable to sign in. Please try again.'
                );
                return;
            }

            if (!data.session || !data.user) {
                setError('Sign-in could not be completed. Please try again.');
                return;
            }

            // App.jsx will react to Supabase's authenticated session.
            onDemoSignIn(data.session);
        } catch {
            setError('Unable to connect to the authentication service.');
        } finally {
            setBusy(false);
        }
    };

    const changeEmail = () => {
        setPassword('');
        setShowPassword(false);
        setError('');
        setStep('email');
    };

    return (
        <main className="login-screen">
            <div className="login-backdrop" aria-hidden="true">
                <span className="backdrop-orb orb-one" />
                <span className="backdrop-orb orb-two" />
                <span className="backdrop-grid" />
            </div>

            <header className="login-topline">
                <a
                    className="login-brand"
                    href="/"
                    aria-label="MARUT Admin"
                >
                    <img
                        className="login-logo login-logo-gold"
                        src="/assets/marut-logo-gold.png"
                        alt="MARUT"
                    />
                    <img
                        className="login-logo login-logo-dark"
                        src="/assets/marut-logo-dark.png"
                        alt="MARUT"
                    />
                </a>

                <div className="login-top-actions">
                    <span className="restricted-label">
                        <LockKeyhole size={13} /> RESTRICTED ACCESS
                    </span>

                    <button
                        type="button"
                        className="theme-toggle"
                        onClick={() =>
                            setTheme(theme === 'dark' ? 'light' : 'dark')
                        }
                        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'
                            } mode`}
                        aria-pressed={theme === 'light'}
                        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'
                            } mode`}
                    >
                        <Sun size={15} />
                        <Moon size={15} />
                        <span className="toggle-knob" />
                    </button>
                </div>
            </header>

            <div className="login-layout">
                <section className="login-story">
                    <div className="eyebrow">
                        <span className="eyebrow-line" />
                        MARUT · GROWN WITH INTENTION
                    </div>

                    <h1>
                        Good things
                        <br />
                        start <em>behind the scenes.</em>
                    </h1>

                    <p>
                        MARUT Admin is a private workspace for the people who
                        keep everything growing. Sign in with your authorized
                        work email to continue.
                    </p>

                    <div className="login-trust">
                        <span className="trust-icon">
                            <ShieldCheck size={19} />
                        </span>
                        <span>
                            <strong>Private by design</strong>
                            <small>
                                Only approved MARUT administrators can enter.
                            </small>
                        </span>
                    </div>
                </section>

                <section className="login-card" aria-labelledby="loginTitle">
                    <div className="login-card-mark">
                        <Leaf size={19} />
                    </div>

                    <div className="login-step-label">
                        STEP 0{step === 'email' ? '1' : '2'}{' '}
                        <span>
                            / {step === 'email' ? 'IDENTITY' : 'PASSWORD'}
                        </span>
                    </div>

                    <h2 id="loginTitle">
                        {step === 'email'
                            ? 'Welcome to MARUT.'
                            : 'Welcome back.'}
                    </h2>

                    <p className="login-description">
                        {step === 'email'
                            ? 'Enter your authorized email address to continue.'
                            : 'Enter your password to securely access your workspace.'}
                    </p>

                    {step === 'email' ? (
                        <form onSubmit={continueWithEmail} noValidate>
                            <label
                                className="login-field-label"
                                htmlFor="workEmail"
                            >
                                Work email
                            </label>

                            <div className="login-input-wrap">
                                <Mail
                                    size={16}
                                    className="input-leading"
                                />
                                <input
                                    id="workEmail"
                                    type="email"
                                    autoComplete="username"
                                    placeholder="you@marut.co.in"
                                    value={email}
                                    onChange={(event) => {
                                        setEmail(event.target.value);
                                        setError('');
                                    }}
                                    autoFocus
                                    disabled={busy}
                                />
                            </div>

                            {error && (
                                <p className="login-error" role="alert">
                                    {error}
                                </p>
                            )}

                            <button
                                className="button button-primary login-submit"
                                type="submit"
                                disabled={busy}
                            >
                                {busy ? (
                                    <>
                                        <span className="button-spinner" />
                                        Verifying email…
                                    </>
                                ) : (
                                    <>
                                        Continue <ArrowRight size={16} />
                                    </>
                                )}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={signIn}>
                            <div className="identity-pill">
                                <span className="identity-avatar">
                                    {email.slice(0, 1).toUpperCase()}
                                </span>

                                <span className="identity-email">
                                    {email}
                                </span>

                                <button
                                    type="button"
                                    className="change-identity"
                                    onClick={changeEmail}
                                    disabled={busy}
                                >
                                    Change
                                </button>
                            </div>

                            <label
                                className="login-field-label"
                                htmlFor="loginPassword"
                            >
                                Password
                            </label>

                            <div className="login-input-wrap">
                                <LockKeyhole
                                    size={16}
                                    className="input-leading"
                                />

                                <input
                                    id="loginPassword"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(event) => {
                                        setPassword(event.target.value);
                                        setError('');
                                    }}
                                    autoFocus
                                    disabled={busy}
                                />

                                <button
                                    className="password-reveal"
                                    type="button"
                                    onClick={() =>
                                        setShowPassword((current) => !current)
                                    }
                                    aria-label={
                                        showPassword
                                            ? 'Hide password'
                                            : 'Show password'
                                    }
                                >
                                    {showPassword ? (
                                        <EyeOff size={16} />
                                    ) : (
                                        <Eye size={16} />
                                    )}
                                </button>
                            </div>

                            {error && (
                                <p className="login-error" role="alert">
                                    {error}
                                </p>
                            )}

                            <button
                                className="button button-primary login-submit"
                                type="submit"
                                disabled={busy}
                            >
                                {busy ? (
                                    <>
                                        <span className="button-spinner" />
                                        Signing in…
                                    </>
                                ) : (
                                    <>
                                        Sign in <ArrowRight size={16} />
                                    </>
                                )}
                            </button>
                        </form>
                    )}

                    <div className="login-divider">
                        <span />
                        <small>SECURE ADMIN PORTAL</small>
                        <span />
                    </div>

                    <p className="login-footnote">
                        <LockKeyhole size={12} />
                        Access is monitored and limited to approved accounts.
                    </p>
                </section>
            </div>

            <footer className="login-footer">
                <span>© 2026 MARUT · Grown with care.</span>
                <span>
                    <i /> Secure workspace
                </span>
            </footer>

            <div className="demo-notice">
                EMAIL AUTHORIZATION CONNECTED · PASSWORD SIGN-IN STILL DEMO ONLY
            </div>
        </main>
    );
}

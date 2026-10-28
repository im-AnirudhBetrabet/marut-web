
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import './set-password.css';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || ''
).replace(/\/+$/, '');

export default function SetPassword() {
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (password.length < 12) {
      setError('Your password must contain at least 12 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      // The invitation callback must have established a valid session.
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setError(
          'Your invitation link is invalid or has expired. Please ask an authorized MARUT admin for assistance.'
        );
        return;
      }

      // Check that this account is authorized for MARUT Admin.
      const response = await fetch(
        `${API_BASE_URL}/api/v1/auth/check-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email: session.user.email,
          }),
        }
      );

      if (!response.ok) {
        setError(
          response.status === 403
            ? 'This account is not authorized to access MARUT Admin.'
            : 'We could not verify your access. Please try again.'
        );
        return;
      }

      // Set the password for the authenticated invitation user.
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      // Confirm the session still exists after the password update.
      const {
        data: { session: updatedSession },
        error: updatedSessionError,
      } = await supabase.auth.getSession();

      if (updatedSessionError || !updatedSession) {
        setError(
          'Your password was updated, but we could not confirm your session. Please sign in.'
        );
        return;
      }

      setSuccess(true);

      // The existing App.jsx session listener should recognize this session.
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Password setup failed:', err);
      setError(
        'Something went wrong. Please try again in a moment.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="set-password-page">
      <section className="set-password-card">
        <Link to="/" className="set-password-brand">
          MARUT<span>.</span>
        </Link>

        <div className="set-password-heading">
          <span className="set-password-eyebrow">
            ADMIN WORKSPACE
          </span>

          <h1>Create your password</h1>

          <p>
            Set up your secure password to access the MARUT
            administration workspace.
          </p>
        </div>

        {success ? (
          <div className="set-password-success" role="status">
            Password set successfully. Opening your workspace…
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label htmlFor="new-password">
              New password
            </label>

            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={12}
              required
              disabled={loading}
              placeholder="At least 12 characters"
            />

            <label htmlFor="confirm-password">
              Confirm password
            </label>

            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              minLength={12}
              required
              disabled={loading}
              placeholder="Enter your password again"
            />

            <p className="set-password-hint">
              Use at least 12 characters. Avoid reusing a password
              from another account.
            </p>

            {error && (
              <div className="set-password-error" role="alert">
                {error}
              </div>
            )}

            <button
              className="set-password-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Setting password…' : 'Set password'}
            </button>
          </form>
        )}

        <p className="set-password-footer">
          Already have access? <Link to="/">Sign in</Link>
        </p>
      </section>
    </main>
  );
}

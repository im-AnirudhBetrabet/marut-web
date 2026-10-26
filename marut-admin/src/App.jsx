
import { useState } from "react";
import React from "react";

export default function App() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  function handleContinue(event) {
    event.preventDefault();
    setError("");

    // Supabase admin authorization will be implemented in the next step.
    setError("Administrator verification isn't connected yet.");
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <img
          className="marut-logo"
          src="/images/marut-logo.png"
          alt="MARUT"
        />

        <p className="eyebrow">ADMINISTRATION</p>
        <h1 id="login-title">Welcome back.</h1>
        <p className="subtitle">
          Sign in to your MARUT administrator account.
        </p>

        <form onSubmit={handleContinue}>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError("");
            }}
            placeholder="you@company.com"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
          />

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit">Continue</button>
        </form>

        <p className="security-note">
          Restricted access · Authorized administrators only
        </p>
      </section>
    </main>
  );
}

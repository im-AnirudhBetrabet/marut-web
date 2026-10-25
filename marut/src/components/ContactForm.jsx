import { useState } from 'react';
import React from 'react';
async function submitInterest(email) {
  // Intentionally local-only until a real backend/email provider is configured.
  return { accepted: false, email };
}

export default function ContactForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setBusy(true);
    try {
      await submitInterest(email.trim());
      setMessage('Thanks for your interest — this form is not connected to an inbox yet.');
    } catch {
      setMessage('Sorry, something went wrong. Please try again later.');
    } finally {
      setBusy(false);
    }
  }

  return <>
    <form className="contact-form" onSubmit={handleSubmit} noValidate={false}>
      <label className="sr-only" htmlFor="email">Your email address</label>
      <input id="email" name="email" type="email" autoComplete="email" placeholder="Your email address" required value={email} onChange={(event) => setEmail(event.target.value)} />
      <button type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Keep me posted ↗'}</button>
    </form>
    <div id="form-message" role="status" aria-live="polite">{message}</div>
  </>;
}


import { useMemo, useState } from 'react';
import '../styles/feedback.css';
import React from 'react';
import { supabase } from '../lib/supabase.js';


const PHONE = import.meta.env.VITE_WHATSAPP_NUMBER;

const VARIETIES = [
  ['Red Radish', '#C8264A'],
  ['White Radish', '#D3E2A8'],
  ['Purple Radish', '#6B2B6E'],
  ['Pink Radish', '#E0558F'],
  ['Fenugreek (Methi)', '#4F8A3A'],
  ['Sunflower', '#7DAF3E'],
  ['Pea Shoots', '#5FA64A'],
  ['Broccoli', '#3E6B3A'],
  ['Mustard', '#6E9E3C'],
  ['Pak Choi', '#2F7A3D'],
];

const QUALITIES = [
  'Freshness',
  'Taste',
  'Texture and crunch',
  'Look on the plate',
];

const SHELF = [
  'Less than 2 days',
  '3 to 4 days',
  '5 days or more',
  'Have not checked',
];

const USE = [
  'Yes, regularly',
  'Yes, now and then',
  'Maybe later',
  'Not right now',
];

const QTY = [
  'Under 500 g',
  '500 g to 1 kg',
  '1 to 3 kg',
  'More than 3 kg',
  'Not sure yet',
];

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function Rating({ name, label, value, onChange, skipLabel = 'Skip' }) {
  return (
    <div className="fb-scale" role="radiogroup" aria-label={label}>
      {[
        ['', skipLabel],
        ...[1, 2, 3, 4, 5].map((n) => [String(n), String(n)]),
      ].map(([rating, text]) => (
        <label
          className={`fb-chip ${rating === '' ? 'fb-skip' : ''}`}
          key={rating}
        >
          <input
            type="radio"
            name={name}
            value={rating}
            checked={value === rating}
            onChange={() => onChange(rating)}
            aria-label={`${label}: ${rating || skipLabel}`}
          />
          <span>{text}</span>
        </label>
      ))}
    </div>
  );
}

function ChoiceGroup({ name, options, value, onChange }) {
  return (
    <div className="fb-choices">
      {options.map((option) => (
        <label className="fb-chip" key={option}>
          <input
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
          />
          <span>{option}</span>
        </label>
      ))}
    </div>
  );
}

export default function Feedback() {
  const [cafe          , setCafe] = useState('');
  const [who           , setWho] = useState('');
  const [phone         , setPhone] = useState('');
  const [notes         , setNotes] = useState('');
  const [kit           , setKit] = useState(false);
  const [varietyRatings, setVarietyRatings] = useState({});
  const [qualityRatings, setQualityRatings] = useState({});
  const [shelf         , setShelf] = useState('');
  const [use           , setUse] = useState('');
  const [qty           , setQty] = useState('');
  const [status        , setStatus] = useState(null);
  const [previewOpen   , setPreviewOpen] = useState(false);
  const [isSubmitting  , setIsSubmitting] = useState(false);


  const message = useMemo(() => {
    const lines = [
      'Hello Marut team, here is our feedback on your microgreen samples.',
      '',
      `Cafe: ${cafe.trim() || '(please add)'}`,
    ];

    if (who.trim()) lines.push(`From: ${who.trim()}`);

    lines.push(`WhatsApp: ${phone.trim() || '(please add)'}`);

    const ratedVarieties = VARIETIES.filter(
      ([name]) => varietyRatings[slug(name)]
    );

    if (ratedVarieties.length) {
      lines.push('', 'Variety ratings (out of 5):');
      ratedVarieties.forEach(([name]) =>
        lines.push(`${name}: ${varietyRatings[slug(name)]}`)
      );
    }

    const ratedQualities = QUALITIES.filter(
      (name) => qualityRatings[slug(name)]
    );

    if (ratedQualities.length) {
      lines.push('', 'Overall (out of 5):');
      ratedQualities.forEach((name) =>
        lines.push(`${name}: ${qualityRatings[slug(name)]}`)
      );
    }

    const extra = [];
    if (shelf) extra.push(`Stayed fresh for: ${shelf}`);
    if (use) extra.push(`Would use on our menu: ${use}`);
    if (qty) extra.push(`Likely weekly need: ${qty}`);
    if (kit) extra.push("Chef's Trial Kit: Yes, please send one");

    if (extra.length) lines.push('', ...extra);
    if (notes.trim()) lines.push('', `Suggestions: ${notes.trim()}`);
    lines.push('', 'Thank you.');

    return lines.join('\n');
  }, [
    cafe, who, phone, notes, kit, varietyRatings,
    qualityRatings, shelf, use, qty,
  ]);

  function validate() {
    if (!cafe.trim()) {
      setStatus({
        tone: 'warn',
        text: 'Add your cafe name so we know who this is from.',
      });
      return false;
    }

    if (phone.replace(/\D/g, '').length < 10) {
      setStatus({
        tone: 'warn',
        text: 'Add your WhatsApp number (at least 10 digits) so we can reach you.',
      });
      return false;
    }

    const hasRatings =
      Object.values(varietyRatings).some(Boolean) ||
      Object.values(qualityRatings).some(Boolean);

    if (!hasRatings && !notes.trim()) {
      setStatus({
        tone: 'warn',
        text: 'Rate at least one item or write a note before sending.',
      });
      return false;
    }

    return true;
  }

  
async function sendWhatsApp() {
    if (isSubmitting || !validate()) return;

    const phoneDigits = PHONE?.replace(/\D/g, '');

    if (!phoneDigits || !/^\d{10,15}$/.test(phoneDigits)) {
        setStatus({
        tone: 'warn',
        text: 'WhatsApp is not configured correctly. Please contact Marut directly.',
        });
        return;
    }

    // Open a window immediately so the browser is less likely to block it
    // after the database request finishes.
    const whatsappUrl =
        `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;

    const whatsappWindow = window.open('about:blank', '_blank');

    setIsSubmitting(true);
    setStatus({
        tone: 'ok',
        text: 'Saving your feedback…',
    });

    try {
        const feedback = {
        cafe_name: cafe.trim(),
        contact_name: who.trim() || null,
        whatsapp_number: phone.trim(),

        variety_ratings: varietyRatings,
        quality_ratings: qualityRatings,

        shelf_life: shelf || null,
        menu_interest: use || null,
        weekly_quantity: qty || null,

        notes: notes.trim() || null,
        wants_trial_kit: kit,
        };

        const { error } = await supabase
        .from('customer_feedback')
        .insert(feedback);

        if (error) throw error;

        setStatus({
        tone: 'ok',
        text: 'Feedback saved successfully. Opening WhatsApp…',
        });

        if (whatsappWindow && !whatsappWindow.closed) {
        whatsappWindow.location.href = whatsappUrl;
        } else {
        // Fallback if the browser blocked the new window.
        window.location.href = whatsappUrl;
        }
    } catch (error) {
        if (whatsappWindow && !whatsappWindow.closed) {
        whatsappWindow.close();
        }

        console.error('Failed to save MARUT feedback:', error);

        setStatus({
        tone: 'warn',
        text: 'We could not save your feedback. Your answers are still here; please try again.',
        });
    } finally {
        setIsSubmitting(false);
    }
    }


  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setStatus({
        tone: 'ok',
        text: 'Message copied. Paste it into WhatsApp or an email.',
      });
    } catch {
      setPreviewOpen(true);
      setStatus({
        tone: 'ok',
        text: 'Select the message below and copy it.',
      });
    }
  }

  return (
    <div className="fb-page">
      <main className="fb-main">
        <header className="fb-header">
          <p className="fb-wordmark">MARUT</p>
          <p className="fb-tagline">
            Fresh, consistent, and grown with respect for the resources behind it.
          </p>
          <h1>How were our microgreen samples?</h1>
          <p className="fb-intro">
            Thank you for giving us the chance to meet you and share our
            freshly harvested samples. A few quick taps will tell us what
            worked in your kitchen and what did not. It takes about two minutes.
          </p>
        </header>

        <form className="fb-form" onSubmit={(event) => event.preventDefault()}>
          <section className="fb-group">
            <h2>About your cafe</h2>

            <label className="fb-field">
              Cafe name
              <input
                value={cafe}
                onChange={(event) => setCafe(event.target.value)}
                placeholder="For example, the cafe's name and area"
                autoComplete="organization"
              />
            </label>

            <label className="fb-field">
              Your name and role <span className="fb-muted">(optional)</span>
              <input
                value={who}
                onChange={(event) => setWho(event.target.value)}
                placeholder="For example, Head Chef or Owner"
                autoComplete="name"
              />
            </label>

            <label className="fb-field">
              WhatsApp number
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="10-digit mobile number"
                autoComplete="tel"
              />
            </label>
          </section>

          <section className="fb-group">
            <h2>The varieties you tried</h2>
            <p className="fb-hint">
              Rate each one from 1 (poor) to 5 (excellent). Leave the rest on Not tried.
            </p>

            <div className="fb-list">
              {VARIETIES.map(([name, color]) => {
                const key = slug(name);
                return (
                  <div className="fb-row" key={name}>
                    <div className="fb-name">
                      <span
                        className="fb-dot"
                        style={{ '--fb-dot': color }}
                        aria-hidden="true"
                      />
                      {name}
                    </div>
                    <Rating
                      name={`v-${key}`}
                      label={name}
                      value={varietyRatings[key] ?? ''}
                      skipLabel="Not tried"
                      onChange={(rating) =>
                        setVarietyRatings((old) => ({
                          ...old,
                          [key]: rating,
                        }))
                      }
                    />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="fb-group">
            <h2>Overall impression</h2>
            <div className="fb-legend">
              <span>1 = Poor</span><span>5 = Excellent</span>
            </div>

            <div className="fb-qualities">
              {QUALITIES.map((quality) => {
                const key = slug(quality);
                return (
                  <div className="fb-quality" key={quality}>
                    <span className="fb-quality-label">{quality}</span>
                    <Rating
                      name={`q-${key}`}
                      label={quality}
                      value={qualityRatings[key] ?? ''}
                      onChange={(rating) =>
                        setQualityRatings((old) => ({
                          ...old,
                          [key]: rating,
                        }))
                      }
                    />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="fb-group">
            <h2>How long did they stay fresh?</h2>
            <ChoiceGroup
              name="shelf"
              options={SHELF}
              value={shelf}
              onChange={setShelf}
            />
          </section>

          <section className="fb-group">
            <h2>Would you use Marut on your menu?</h2>
            <ChoiceGroup
              name="use"
              options={USE}
              value={use}
              onChange={setUse}
            />
          </section>

          <section className="fb-group">
            <h2>Roughly how much would you need each week?</h2>
            <ChoiceGroup
              name="qty"
              options={QTY}
              value={qty}
              onChange={setQty}
            />
          </section>

          <section className="fb-group">
            <h2>Anything we should improve?</h2>
            <label className="fb-field">
              <span className="fb-muted">
                Taste, size, packing, delivery time, price, or anything else
              </span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Your suggestions help us grow better for you"
              />
            </label>

            <label className="fb-check">
              <input
                type="checkbox"
                checked={kit}
                onChange={(event) => setKit(event.target.checked)}
              />
              <span>
                Yes, please send a Chef's Trial Kit with a few more varieties
                for our Head Chef.
              </span>
            </label>
          </section>

          <section className="fb-send">
            <h2>Send your feedback</h2>
            <p className="fb-disclaimer">
                By submitting this feedback, you agree that MARUT may store and review
                your responses to improve our products and service. We may also contact
                you to discuss your feedback, understand your requirements, or explore
                how we can work together.
            </p>
            <button
                className="fb-btn fb-primary"
                type="button"
                onClick={sendWhatsApp}
                disabled={isSubmitting}
                >
                {isSubmitting ? 'Saving feedback…' : 'Send feedback'}
            </button>
            <p
              className="fb-status"
              data-tone={status?.tone ?? 'ok'}
              role="status"
              aria-live="polite"
            >
              {status?.text ?? ''}
            </p>

            <details
              open={previewOpen}
              onToggle={(event) => setPreviewOpen(event.currentTarget.open)}
              className="fb-preview"
            >
              <summary>Preview your message</summary>
              <textarea readOnly value={message} aria-label="Your feedback message" />
            </details>
          </section>
        </form>

        <footer className="fb-footer">
          <p>
            Questions? Call <strong>{PHONE.replace(/^91/, '')}</strong> or write to{' '}
            <strong>info@marut.co.in</strong>.
          </p>
          <p>Marut, microgreens grown in Bengaluru.</p>
        </footer>
      </main>
    </div>
  );
}

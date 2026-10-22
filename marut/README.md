# MARUT

A React + Vite migration of the supplied MARUT standalone HTML prototype. It retains the editorial layout, typography, original photography, logo, two colour palettes, marquee, responsive sections, and scroll reveals.

## Requirements
- Node.js 20.19+ or 22.12+
- npm

## Local development
```bash
npm install
npm run dev
```
Open the local URL printed by Vite.

## Production build
```bash
npm run build
npm run preview
```
The static production output is written to `dist/`.

## Deployment
Import the repository into Vercel. Vercel detects Vite automatically; use `npm run build` as the build command and `dist` as the output directory. No server-side runtime or environment variables are required.

## Implementation notes
- React components own the page sections and shared header, footer, marquee, theme toggle, and contact form.
- Earth tones are the default. The theme toggle switches the central CSS custom properties to the prototype's original forest/lime/orange palette. The selection is persisted when browser storage is available.
- Scroll reveals use `IntersectionObserver` and clean up on unmount. Reduced-motion users see content immediately.
- The supplied logo was extracted from the prototype's embedded PNG. Existing Unsplash image sources are retained; the hero image is eager/high priority and below-the-fold images are lazy-loaded.
- The contact form validates email format in the browser but intentionally does not send or store submissions. `submitInterest` is the isolated integration point for a future provider/backend.
- Parallax from the prototype's later script was removed, as requested. Header hide-on-scroll was also omitted to avoid hiding navigation unexpectedly; the sticky header and scrolled styling remain in CSS.
- There is no canonical URL because a production domain was not supplied.

# q4o Landing Page - Claude Context

## Project
- **Site**: q4o.fraillon.com (Paris data studio - senior engineers + AI agents)
- **Entity**: Q4O (damequatre)
- **Owner**: Vincent Fraillon (vincentfraillon@gmail.com)
- **Repo**: github.com/chiptuned/q4o-landing
- **Hosting**: Cloudflare Pages (auto-deploy from `main` branch, static only - no backend)
- **Cloudflare Account ID**: dce9680662db8036f38af067d7e6935f

## Architecture
- `index.html` - landing page (~1930 lines), fully self-contained (inline CSS + JS)
- `contact.html` - CTA route "Two doors" (static, vanilla HTML/CSS/JS, no React)
- `logo.svg` - Q4O wordmark
- `logos/` - 8 client SVG logos used in the marquee strip
- Font: Inter (Google Fonts, weights 400-900 + italic)
- GSAP 3.12.5 + ScrollTrigger (CDN) - used only on landing for the editorial-spotlight scroll effect and the wireframe-wave canvas

## Positioning
- Editorial rewrite (April 2026). Previous pitch ("AI Consultants for 70% Less") replaced with:
  - Headline: *"Ambitious projects, actually shipped."*
  - Sub: Paris data studio, senior engineers on every line, scoped in 48h, shipped in weeks, yours forever
- French sovereignty (Scaleway, GDPR-native) + closed-source positioning

## index.html - Sections (top to bottom)
1. **Nav** - sticky, `logo.svg` + links (Services/Savings/Process/FAQ) + "Let's talk ↗" → `/contact.html`
2. **Hero** - eyebrow, headline with italic accent, 2 CTAs (primary → `/contact.html`), stats row (48h / 100% / 0 juniors). Canvas wireframe-wave animation as backdrop.
3. **Logos marquee** - infinite-scroll CSS marquee, 8 real client logos (BNP Paribas, Saint-Gobain, Carrefour, IQVIA, AGS, Colisée, Cedrus & Partners, Afdas)
4. **Value Reveal** (editorial spotlight) - 4 stat lines, each blurs in/out as it crosses viewport center (rAF-throttled scroll listener, no GSAP needed for this)
5. **Expertise** - 4-card grid with mono `A / 01…04` catalog numbers + italic-accent titles
6. **Why it works** - 3-card lean methodology (0 rework, 5× quality checkpoints, ∞ continuous learning) + methodology badge + timing signal
7. **Calculator** - savings estimator (slider + month buttons, `ESN_RATE_PER_MONTH = 18000`, `Q4O_RATIO = 0.50`)
8. **Process** - 4-step timeline with italic numerals
9. **Trust** - 4-card non-negotiables grid
10. **FAQ** - accordion, 5 questions, 2-column layout
11. **Giant Stroke Logo** - full-width SVG Q4O outline (stroke-only, `#e0e0e0`)
12. **CTA Banner** - dark block, "Tell us what you're trying to ship" → `/contact.html`
13. **Footer** - Legal HQ (173 rue de Courcelles, 75017 Paris) + Desks (Intencity Reuilly, 31 Rue de Reuilly, 75012 Paris) + partnerships mailto

## contact.html - "Two Doors"
- Single-card layout: wordmark + breadcrumb header → card with hero (portrait grid 320px 1fr) → status banner → two doors → trust footer
- Portrait pulled from `https://vincent.fraillon.com/avatar.jpg` (external, with inline fallback placeholder)
- Status banner has live Paris-time clock (`Intl.DateTimeFormat` with `Europe/Paris`, refreshed every 30s)
- **Door 1 (secondary, light)**: *"Request a callback"* → `mailto:vincentfraillon@gmail.com` with pre-filled subject + body template asking for name/phone/callback-window
- **Door 2 (primary, dark)**: *"Book a 30-min slot"* → `https://calendar.app.google/7fi6qx2f3euP369i8` (Google Appointment Schedule)
- No React, no availability engine, no Aircall bridge - this is **Phase 1 / Option A**. Phase 2 would add live telephony (Cloudflare Workers + Aircall ~€30/mo + rate limiting + GDPR plumbing)
- Derived from `design_handoff_contact_vincent/` prototype (deleted, in git history) - full spec still useful for Phase 2 rebuild

## CSS design tokens (current)
- **Accent (teal-cyan)**: `--accent: #0891a1` (replaces old purple `#7c3aed`)
- **Accent light**: `--accent-light: #5eb8c4`
- **Synthwave extras** (landing only): `--accent-2: #7c6fb3` (violet), `--accent-3: #b85983` (rose)
- **Contact page palette**: `--ink: #0b1220`, `--surface: #f8fafc`, warm page bg `linear-gradient(180deg, #f6f5f1 0%, #eeece6 100%)`
- **Fonts**: Inter (sans + italic), `ui-monospace` for mono labels/tags

## Features worth knowing
- **Dark mode** (landing only) - `data-theme="dark"` on `<html>`, gated by `prefers-color-scheme` + localStorage via the dev bar
- **i18n EN/FR** (landing only) - `data-i18n` / `data-i18n-html` attributes, EN harvested from DOM, FR dictionary inline in the script tag
- **Dev bar** - hidden by default, unlock via `?dev=1` in URL or ⌥⇧D keyboard shortcut. Toggles theme (light/system/dark) and lang (EN/FR).

## Email setup
- **Domain**: q4o.com (managed as Cloudflare zone)
- **Inbound**: Cloudflare Email Routing → forwards to vincentfraillon@gmail.com
  - Routes: `vincent@q4o.com`, `partnerships@q4o.com`, `admin@q4o.com`, plus `*@q4o.com` catch-all
  - MX records auto-managed by Cloudflare
- **Outbound**: Gmail "Send mail as" via Brevo SMTP relay (`smtp-relay.brevo.com:587`, TLS)
  - Brevo free tier: 300 emails/day
  - SPF/DKIM/DMARC TXT records live on q4o.com zone in Cloudflare (added during Brevo domain auth)
  - SMTP credentials in `.env.local` as `BREVO_SMTP_USER` and `BREVO_SMTP_KEY` (never in git; also backed up in 1Password / password manager — the key is shown once by Brevo)
  - Gmail "From:" aliases configured per address: `vincent@`, `partnerships@`, `admin@`
  - Gmail Settings → Accounts → "Reply from the same address the message was sent to"
- **Sending logs**: Brevo dashboard → Statistics → Email → Transactional (14-day retention on free tier)

## Deployment
- Push to `main` → Cloudflare Pages auto-builds (~10-30s)
- Hard refresh (Cmd+Shift+R) often needed due to CDN caching
- Cloudflare dashboard frequently crashes - navigate directly to specific URLs instead

## Git
- SSH key: ~/.ssh/id_ed25519
- GitHub deploy key: "cowork-vm"
- Branch: `main` only

## Related
- Welcome Hub: vincent.fraillon.com (repo: chiptuned/welcome-hub) - hosts the portrait asset `/avatar.jpg`

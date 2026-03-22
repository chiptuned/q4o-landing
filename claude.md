# q4o Landing Page — Claude Context

## Project
- **Site**: q4o.fraillon.com (AI consulting firm landing page)
- **Entity**: q4o (damequatre)
- **Owner**: Vincent Fraillon (vincentfraillon@gmail.com)
- **Repo**: github.com/chiptuned/q4o-landing
- **Hosting**: Cloudflare Pages (auto-deploy from `main` branch)
- **Cloudflare Account ID**: dce9680662db8036f38af067d7e6935f

## Architecture
- Single `index.html` file (~950 lines), fully self-contained (inline CSS + JS)
- `logo.svg` — Q4O wordmark
- Font: Inter (Google Fonts)
- GSAP 3.12.5 + ScrollTrigger (CDN) for scroll animations

## Sections (top to bottom)
1. **Nav** — sticky, logo + links + CTA
2. **Hero** — headline "AI Consultants for 70% Less.", subtitle, 2 CTAs
3. **Logos** — "Replacing the overhead of" Accenture, Capgemini, Theodo, McKinsey Digital, BCG X
4. **CopyReveal** (Apple-style) — 4 stat lines spotlight one-by-one on scroll (GSAP ScrollTrigger, 300vh sticky runway). Stats: "70% lower project costs", "Zero ramp-up time", "AI agents supervised by senior leads", "Lean methodology. No bloat."
5. **Expertise** — 4-card grid: Data Engineering, AI/ML Engineering, Full-Stack Development, AI Strategy
6. **Calculator** — savings estimator (slider + month buttons, ESN rate €18k/month, 70% savings)
7. **Process** — 4-step timeline: Scope → Configure → Ship → Scale
8. **FAQ** — accordion, 5 questions
9. **Giant Stroke Logo** — full-width SVG Q4O outline (stroke-only, #e0e0e0)
10. **CTA Banner** — "Ready to cut project costs by 70%?" + email link
11. **Footer** — two columns: Legal HQ (173 rue de Courcelles, 75017 Paris) + Desks (Intencity Reuilly, 31 Rue de Reuilly, 75012 Paris)

## CSS Variables
- `--accent: #7c3aed` (purple)
- `--accent-light: #a78bfa`
- Dark text on white background

## Key Design Decisions
- **NO card animation** — was attempted (poker card throw on scroll) but removed. User does NOT want it.
- CopyReveal uses CSS transitions (opacity, transform, blur) toggled by JS class changes
- Mobile: cards-stage hidden, expertise grid stacks to 1 col, CopyReveal runway shrinks to 200vh

## Deployment
- Push to `main` → Cloudflare Pages auto-builds (takes ~10-30s)
- Hard refresh (Cmd+Shift+R) often needed due to CDN caching
- Cloudflare dashboard frequently crashes — navigate directly to specific URLs instead

## Git
- SSH key: ~/.ssh/id_ed25519
- GitHub deploy key: "cowork-vm"
- Branch: `main` only

## Related
- Welcome Hub: vincent.fraillon.com (repo: chiptuned/welcome-hub)

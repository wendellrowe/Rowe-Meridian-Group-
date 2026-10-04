# Rowe Meridian Group℠ — Website

Static site for Rowe Meridian Group℠, served by a Cloudflare Worker with a static
assets binding. Same architecture as `wendellrowe-site`.

## Security posture

The production zone should use Cloudflare's normal security controls rather than
**Under Attack** mode during ordinary operation. Under Attack mode adds a Managed
Challenge to visitors and can interfere with first-contact traffic and crawling.
Cloudflare's baseline DDoS protection remains active independently.

The Worker applies security headers to every response and preserves range
requests for audio/video without rewriting HTML response bodies.

## Structure

| Path                | Purpose                                                          |
| ------------------- | ---------------------------------------------------------------- |
| `index.html`        | Single-page site: Mandate, Practice, Method, Evidence, Principal, Engagement |
| `privacy.html`      | One-page privacy notice for the inquiry form                     |
| `404.html`          | Branded not-found page                                           |
| `base.css`          | Reset, font loading, accessibility primitives                    |
| `style.css`         | Design tokens and components                                     |
| `app.js`            | Header state, scroll progress, reveals, scroll-spy, inquiry form  |
| `src/index.js`      | Worker: www→apex redirect, `/api/inquiry`, 404 handling           |
| `wrangler.jsonc`    | Worker configuration                                             |
| `assets/`           | Crest, favicon, share card, self-hosted Cinzel + Inter subsets   |
| `licenses/`         | SIL Open Font License texts for Cinzel and Inter                 |

## Design system

Inherited from `wendellrowe-site` so the two properties read as one brand.

```
--black: #050505   --gold: #c6a75e   --gold-bright: #e6d39a   --gold-deep: #7c5920
--ivory: #eee9df   --muted: #a9a49a  --dim: #6f6b64
--serif: Cinzel    --sans: Inter
```

## Local development

```bash
npm install
npm run dev        # wrangler dev, includes the /api/inquiry endpoint
```

For a plain static preview without the Worker:

```bash
python3 -m http.server 4321
```

## Deployment

```bash
npm install
npx wrangler deploy
```

Cloudflare Builds is connected to the repository's `main` branch. Each push to
`main` triggers a Worker deployment.

Deploys to `rowemeridiangroup.com`, `www.rowemeridiangroup.com`,
`rowemeridian.com`, and `www.rowemeridian.com`. The alternate hosts redirect
to the canonical `rowemeridiangroup.com` address.

### Inquiry email

`/api/inquiry` uses the Cloudflare Email Routing `send_email` binding to deliver
to `hello@wendellrowe.com`. The sending address (`inquiries@wendellrowe.com`)
must be a verified destination in Email Routing. If the endpoint is unreachable,
the front end falls back to opening a prepared `mailto:` draft, so the form never
dead-ends.

## Fonts

Cinzel and Inter are self-hosted variable subsets under the SIL Open Font License
1.1. License texts are in `licenses/`.

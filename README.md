# Rowe Meridian Group℠ — Website

Static site for Rowe Meridian Group℠, served by a Cloudflare Worker with a static
assets binding. Same architecture as `wendellrowe-site`.

## First contact (Cloudflare)

Search engines and some visitors still hit a Managed Challenge. That is a **zone
security setting**, not a site-code setting. In the Cloudflare dashboard:

1. Security → Settings → Security Level → **Low** or **Essentially Off** (not I’m Under Attack).
2. Security → Bots → Bot Fight Mode and Super Bot Fight Mode → **Off**.
3. Security → WAF → Custom rules → disable any rule that Challenges or Blocks all traffic.
4. Caching → Configuration → **Purge Everything**.

Until that 403 challenge is gone, Google can keep showing stale copy (San José).

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

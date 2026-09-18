# Rowe Meridian Group℠ — Website

Static site for Rowe Meridian Group℠, served by a Cloudflare Worker with a static
assets binding. Same architecture as `wendellrowe-site`.

## Structure

| Path                | Purpose                                                          |
| ------------------- | ---------------------------------------------------------------- |
| `index.html`        | Single-page site: Mandate, Practice, Method, Evidence, Principal, Engagement |
| `404.html`          | Branded not-found page                                           |
| `base.css`          | Reset, font loading, accessibility primitives                    |
| `style.css`         | Design tokens and components                                     |
| `app.js`            | Header state, scroll progress, reveals, scroll-spy, inquiry form  |
| `src/index.js`      | Worker: www→apex redirect, `/api/inquiry`, 404 handling           |
| `wrangler.jsonc`    | Worker configuration                                             |
| `assets/`           | Crest, favicon, self-hosted Cinzel + Inter subsets               |
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

This deploys to a `*.workers.dev` URL. To attach a custom domain, add the domain
to the Cloudflare account, then uncomment and edit the `routes` block in
`wrangler.jsonc` and redeploy.

### Inquiry email

`/api/inquiry` uses the Cloudflare Email Routing `send_email` binding to deliver
to `hello@wendellrowe.com`. The sending address (`inquiries@wendellrowe.com`)
must be a verified destination in Email Routing. If the endpoint is unreachable,
the front end falls back to opening a prepared `mailto:` draft, so the form never
dead-ends.

## Fonts

Cinzel and Inter are self-hosted variable subsets under the SIL Open Font License
1.1. License texts are in `licenses/`.
